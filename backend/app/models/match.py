from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Float, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    opponent = Column(String, nullable=False)
    is_home = Column(Boolean, default=True)
    competition = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    club_id     = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    goals_for = Column(Integer, nullable=True)
    goals_against = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    # Provenance for imported matches (Wyscout/InStat): lets a re-import find the
    # same match instead of creating a duplicate. Null for manually-created matches.
    external_ref = Column(String, nullable=True, index=True)
    source = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stats = relationship("MatchStat", back_populates="match", cascade="all, delete-orphan")


class MatchStat(Base):
    __tablename__ = "match_stats"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player = relationship("Player", back_populates="match_stats")
    match = relationship("Match", back_populates="stats")

    # Participación
    minutes_played = Column(Integer, default=0)
    started = Column(Boolean, default=False)
    rating = Column(Float, nullable=True)  # 1-10

    # Ofensivo
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    shots_total = Column(Integer, default=0)
    shots_on_target = Column(Integer, default=0)
    key_passes = Column(Integer, default=0)

    # Pases
    passes_total = Column(Integer, default=0)
    passes_completed = Column(Integer, default=0)

    # Defensivo
    tackles = Column(Integer, default=0)
    interceptions = Column(Integer, default=0)
    clearances = Column(Integer, default=0)
    fouls_committed = Column(Integer, default=0)
    fouls_received = Column(Integer, default=0)
    yellow_cards = Column(Integer, default=0)
    red_cards = Column(Integer, default=0)

    # Duelos
    duels_total = Column(Integer, default=0)
    duels_won = Column(Integer, default=0)
    aerial_duels_total = Column(Integer, default=0)
    aerial_duels_won = Column(Integer, default=0)

    # Físico (GPS)
    total_distance_m = Column(Float, nullable=True)
    high_intensity_distance_m = Column(Float, nullable=True)  # >19.8 km/h
    sprint_distance_m = Column(Float, nullable=True)           # >25.2 km/h
    max_speed_kmh = Column(Float, nullable=True)
    sprints_count = Column(Integer, nullable=True)
    accelerations_count = Column(Integer, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
