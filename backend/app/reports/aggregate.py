"""Executive-report aggregation (pure DB → data model, no PDF).

Split from rendering on purpose — same shape as the importer ``parse``/``apply``
split: this module is fully testable without reportlab, and the JSON endpoint
serves exactly the same numbers the PDF prints.

Everything is **tenant-scoped** by ``club_id``. Tables that carry ``club_id``
(players, matches, training, recovery) are filtered directly; tables that don't
(injuries, match stats, wellness) are scoped through their player's club.

The risk-outlook section calls :func:`app.ml.injury_risk.calculate_injury_risk`,
so it automatically uses the trained B2 model when present and the heuristic
otherwise — the report records which, for provenance.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..ml.injury_risk import calculate_injury_risk
from ..models.club import Club
from ..models.injury import Injury
from ..models.match import Match, MatchStat
from ..models.player import Player, PlayerStatus
from ..models.recovery import RecoveryRecord
from ..models.training import TrainingSession

_TOP_RISK = 8           # players surfaced in the risk outlook
_TOP_ZONES = 6          # body zones surfaced in the injury breakdown


@dataclass
class KPISummary:
    squad_size: int = 0
    available: int = 0
    injured: int = 0
    recovering: int = 0
    suspended: int = 0
    availability_rate: float = 0.0
    active_injuries: int = 0
    matches_played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    points_per_game: Optional[float] = None
    goals_for: int = 0
    goals_against: int = 0
    avg_team_rating: Optional[float] = None
    training_sessions: int = 0
    total_distance_km: float = 0.0
    high_risk_players: int = 0


@dataclass
class InjuryBurden:
    count_in_period: int = 0
    days_lost: int = 0
    avg_days_out: Optional[float] = None
    surgeries: int = 0
    by_zone: Dict[str, int] = field(default_factory=dict)
    by_mechanism: Dict[str, int] = field(default_factory=dict)
    by_severity: Dict[str, int] = field(default_factory=dict)
    by_month: Dict[str, int] = field(default_factory=dict)


@dataclass
class LoadSummary:
    total_load: float = 0.0
    avg_weekly_load: float = 0.0
    sessions: int = 0
    acwr_danger_count: int = 0
    acwr_optimal_count: int = 0
    weekly_trend: List[Dict[str, object]] = field(default_factory=list)


@dataclass
class MatchRow:
    date: str
    opponent: str
    home: bool
    goals_for: Optional[int]
    goals_against: Optional[int]
    result: Optional[str]      # "V" | "E" | "D" | None
    avg_rating: Optional[float]


@dataclass
class MatchPerformance:
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_diff: int = 0
    points: int = 0
    points_per_game: Optional[float] = None
    matches: List[MatchRow] = field(default_factory=list)


@dataclass
class RiskItem:
    player_id: int
    player_name: str
    position: Optional[str]
    score: float
    level: str
    top_factor: Optional[str] = None
    top_factor_value: Optional[object] = None


@dataclass
class RecoverySummary:
    records: int = 0
    avg_hrv_rmssd: Optional[float] = None
    avg_resting_hr: Optional[float] = None
    avg_sleep_hours: Optional[float] = None


@dataclass
class ExecutiveReport:
    club_name: str
    period_from: str
    period_to: str
    generated_at: str
    category_label: str
    kpi: KPISummary
    injuries: InjuryBurden
    load: LoadSummary
    matches: MatchPerformance
    risk_outlook: List[RiskItem]
    recovery: RecoverySummary
    model_provenance: str

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


# ── helpers ────────────────────────────────────────────────────────────────
def _fnum(v) -> Optional[float]:
    return None if v is None else round(float(v), 2)


def _result_letter(gf: Optional[int], ga: Optional[int]) -> Optional[str]:
    if gf is None or ga is None:
        return None
    if gf > ga:
        return "V"
    if gf == ga:
        return "E"
    return "D"


def _iso_week_label(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-S{w:02d}"


# ── main entry point ─────────────────────────────────────────────────────────
def build_executive_report(
    db: Session,
    *,
    club_id: int,
    date_from: date,
    date_to: date,
    category_id: Optional[int] = None,
) -> ExecutiveReport:
    """Aggregate every section of the board-level report for a club & period."""
    club = db.query(Club).filter(Club.id == club_id).first()
    club_name = club.name if club else f"Club #{club_id}"

    # Squad in scope (active players of this club, optionally one category).
    players_q = db.query(Player).filter(
        Player.club_id == club_id, Player.is_active == True  # noqa: E712
    )
    if category_id is not None:
        players_q = players_q.filter(Player.category_id == category_id)
    players = players_q.all()
    player_ids = [p.id for p in players]

    category_label = "Todas las categorías"
    if category_id is not None:
        from ..models.category import Category

        cat = db.query(Category).filter(Category.id == category_id).first()
        if cat:
            category_label = cat.name

    kpi, risk_outlook, high_risk, provenance = _squad_and_risk(
        db, players, date_from, date_to
    )
    injuries = _injury_burden(db, player_ids, date_from, date_to)
    load = _load_summary(db, player_ids, date_from, date_to)
    matches = _match_performance(db, club_id, date_from, date_to, category_id)
    recovery = _recovery_summary(db, club_id, player_ids, date_from, date_to)

    # Fold match + load + risk results into the KPI header.
    kpi.matches_played = len(matches.matches)
    kpi.wins, kpi.draws, kpi.losses = matches.wins, matches.draws, matches.losses
    kpi.goals_for, kpi.goals_against = matches.goals_for, matches.goals_against
    kpi.points_per_game = matches.points_per_game
    kpi.training_sessions = load.sessions
    kpi.high_risk_players = high_risk
    kpi.avg_team_rating = _team_avg_rating(db, club_id, date_from, date_to, category_id)
    kpi.total_distance_km = round(
        _period_distance_m(db, player_ids, date_from, date_to) / 1000.0, 1
    )

    return ExecutiveReport(
        club_name=club_name,
        period_from=date_from.isoformat(),
        period_to=date_to.isoformat(),
        generated_at=datetime.now().isoformat(timespec="seconds"),
        category_label=category_label,
        kpi=kpi,
        injuries=injuries,
        load=load,
        matches=matches,
        risk_outlook=risk_outlook,
        recovery=recovery,
        model_provenance=provenance,
    )


def _squad_and_risk(db, players, date_from, date_to):
    kpi = KPISummary(squad_size=len(players))
    by_status: Dict[str, int] = {}
    for p in players:
        key = p.status.value if p.status else "unknown"
        by_status[key] = by_status.get(key, 0) + 1
    kpi.available = by_status.get(PlayerStatus.AVAILABLE.value, 0)
    kpi.injured = by_status.get(PlayerStatus.INJURED.value, 0)
    kpi.recovering = by_status.get(PlayerStatus.RECOVERING.value, 0)
    kpi.suspended = by_status.get(PlayerStatus.SUSPENDED.value, 0)
    kpi.availability_rate = (
        round(kpi.available / kpi.squad_size * 100, 1) if kpi.squad_size else 0.0
    )

    # Risk outlook for available/recovering players (skip already-injured: their
    # unavailability is a fact, not a prediction).
    candidates = [
        p for p in players if p.status != PlayerStatus.INJURED
    ]
    items: List[RiskItem] = []
    provenance = "heuristic"
    for p in candidates:
        risk = calculate_injury_risk(p.id, db)
        if risk.get("method") == "model":
            provenance = f"model ({risk.get('model_trained_on', 'unknown')})"
        top_factor, top_value = _dominant_factor(risk.get("factors", {}))
        items.append(RiskItem(
            player_id=p.id,
            player_name=p.full_name,
            position=p.position.value if p.position else None,
            score=round(float(risk.get("score", 0.0)), 1),
            level=risk.get("level", "low"),
            top_factor=top_factor,
            top_factor_value=top_value,
        ))

    high_risk = sum(1 for it in items if it.level in ("high", "critical"))
    items.sort(key=lambda it: it.score, reverse=True)
    return kpi, items[:_TOP_RISK], high_risk, provenance


def _dominant_factor(factors: Dict[str, dict]):
    """Pick the factor that pushes risk up the most (highest contribution)."""
    best_label, best_value, best_contrib = None, None, None
    for f in factors.values():
        contrib = f.get("contribution")
        if contrib is None:
            continue
        if best_contrib is None or contrib > best_contrib:
            best_contrib, best_label, best_value = contrib, f.get("label"), f.get("value")
    return best_label, best_value


def _injury_burden(db, player_ids, date_from, date_to) -> InjuryBurden:
    burden = InjuryBurden()
    if not player_ids:
        return burden
    injuries = (
        db.query(Injury)
        .filter(
            Injury.player_id.in_(player_ids),
            Injury.injury_date >= date_from,
            Injury.injury_date <= date_to,
        )
        .all()
    )
    burden.count_in_period = len(injuries)
    if not injuries:
        return burden

    days = [i.actual_days_out or i.estimated_days_out or 0 for i in injuries]
    burden.days_lost = int(sum(days))
    known = [d for d in days if d]
    burden.avg_days_out = round(sum(known) / len(known), 1) if known else None
    burden.surgeries = sum(1 for i in injuries if i.surgery_required)

    for i in injuries:
        burden.by_zone[i.body_zone.value] = burden.by_zone.get(i.body_zone.value, 0) + 1
        burden.by_mechanism[i.mechanism.value] = burden.by_mechanism.get(i.mechanism.value, 0) + 1
        burden.by_severity[i.severity.value] = burden.by_severity.get(i.severity.value, 0) + 1
        mkey = i.injury_date.strftime("%Y-%m")
        burden.by_month[mkey] = burden.by_month.get(mkey, 0) + 1

    # Keep only the top zones; sort the rest for stable output.
    burden.by_zone = dict(
        sorted(burden.by_zone.items(), key=lambda kv: kv[1], reverse=True)[:_TOP_ZONES]
    )
    burden.by_mechanism = dict(sorted(burden.by_mechanism.items()))
    burden.by_severity = dict(sorted(burden.by_severity.items()))
    burden.by_month = dict(sorted(burden.by_month.items()))
    return burden


def _load_summary(db, player_ids, date_from, date_to) -> LoadSummary:
    summary = LoadSummary()
    if not player_ids:
        return summary
    sessions = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.player_id.in_(player_ids),
            TrainingSession.session_date >= date_from,
            TrainingSession.session_date <= date_to,
        )
        .all()
    )
    summary.sessions = len(sessions)
    summary.total_load = round(
        sum(s.session_load for s in sessions if s.session_load) or 0.0, 1
    )

    # Weekly load trend (ISO weeks across the period).
    weekly: Dict[str, float] = {}
    for s in sessions:
        if s.session_load:
            wk = _iso_week_label(s.session_date)
            weekly[wk] = weekly.get(wk, 0.0) + float(s.session_load)
    summary.weekly_trend = [
        {"week": wk, "load": round(load, 1)} for wk, load in sorted(weekly.items())
    ]
    if weekly:
        summary.avg_weekly_load = round(sum(weekly.values()) / len(weekly), 1)

    # ACWR snapshot per player: latest value within the period.
    for pid in player_ids:
        row = (
            db.query(TrainingSession.acwr)
            .filter(
                TrainingSession.player_id == pid,
                TrainingSession.session_date <= date_to,
                TrainingSession.acwr.isnot(None),
            )
            .order_by(TrainingSession.session_date.desc())
            .first()
        )
        if row and row[0] is not None:
            acwr = float(row[0])
            if acwr > 1.5:
                summary.acwr_danger_count += 1
            elif 0.8 <= acwr <= 1.3:
                summary.acwr_optimal_count += 1
    return summary


def _match_performance(db, club_id, date_from, date_to, category_id) -> MatchPerformance:
    perf = MatchPerformance()
    q = db.query(Match).filter(
        Match.club_id == club_id,
        Match.date >= date_from,
        Match.date <= date_to,
    )
    if category_id is not None:
        q = q.filter(Match.category_id == category_id)
    matches = q.order_by(Match.date.asc()).all()

    points = 0
    scored_games = 0
    for m in matches:
        avg_rating = (
            db.query(func.avg(MatchStat.rating))
            .filter(MatchStat.match_id == m.id, MatchStat.rating.isnot(None))
            .scalar()
        )
        res = _result_letter(m.goals_for, m.goals_against)
        perf.matches.append(MatchRow(
            date=m.date.isoformat(),
            opponent=m.opponent,
            home=bool(m.is_home),
            goals_for=m.goals_for,
            goals_against=m.goals_against,
            result=res,
            avg_rating=_fnum(avg_rating),
        ))
        if res is not None:
            scored_games += 1
            perf.goals_for += m.goals_for or 0
            perf.goals_against += m.goals_against or 0
            if res == "V":
                perf.wins += 1
                points += 3
            elif res == "E":
                perf.draws += 1
                points += 1
            else:
                perf.losses += 1
    perf.goal_diff = perf.goals_for - perf.goals_against
    perf.points = points
    perf.points_per_game = round(points / scored_games, 2) if scored_games else None
    return perf


def _recovery_summary(db, club_id, player_ids, date_from, date_to) -> RecoverySummary:
    summary = RecoverySummary()
    if not player_ids:
        return summary
    agg = (
        db.query(
            func.count(RecoveryRecord.id),
            func.avg(RecoveryRecord.hrv_rmssd),
            func.avg(RecoveryRecord.resting_hr),
            func.avg(RecoveryRecord.sleep_duration_h),
        )
        .filter(
            RecoveryRecord.club_id == club_id,
            RecoveryRecord.record_date >= date_from,
            RecoveryRecord.record_date <= date_to,
        )
        .first()
    )
    if agg and agg[0]:
        summary.records = int(agg[0])
        summary.avg_hrv_rmssd = _fnum(agg[1])
        summary.avg_resting_hr = _fnum(agg[2])
        summary.avg_sleep_hours = _fnum(agg[3])
    return summary


def _team_avg_rating(db, club_id, date_from, date_to, category_id) -> Optional[float]:
    q = (
        db.query(func.avg(MatchStat.rating))
        .join(Match, MatchStat.match_id == Match.id)
        .filter(
            Match.club_id == club_id,
            Match.date >= date_from,
            Match.date <= date_to,
            MatchStat.rating.isnot(None),
        )
    )
    if category_id is not None:
        q = q.filter(Match.category_id == category_id)
    return _fnum(q.scalar())


def _period_distance_m(db, player_ids, date_from, date_to) -> float:
    if not player_ids:
        return 0.0
    total = (
        db.query(func.sum(TrainingSession.total_distance_m))
        .filter(
            TrainingSession.player_id.in_(player_ids),
            TrainingSession.session_date >= date_from,
            TrainingSession.session_date <= date_to,
        )
        .scalar()
    )
    return float(total or 0.0)
