"""Render an :class:`ExecutiveReport` to a board-ready PDF (bytes).

Uses **reportlab** — pure-Python, pip-installable, no native system libraries
(unlike WeasyPrint's cairo/pango), which matters for a Windows dev box and a
slim Linux container alike. Charts use reportlab's own ``graphics`` package, so
there is no matplotlib/backend dependency either.

``reportlab`` is imported lazily inside :func:`render_executive_pdf` so the rest
of the API keeps importing on a host without the extra installed; the endpoint
returns a clear 503 in that case.
"""
from __future__ import annotations

import io
from typing import Dict, List

from .aggregate import ExecutiveReport

# Spanish display labels for enum values coming out of the DB.
_STATUS_ES = {
    "available": "Disponibles", "injured": "Lesionados",
    "recovering": "En recuperación", "suspended": "Suspendidos",
    "inactive": "Inactivos", "unknown": "Sin estado",
}
_MECH_ES = {
    "contact": "Contacto", "non_contact": "Sin contacto",
    "overload": "Sobrecarga", "reinjury": "Recidiva",
}
_SEV_ES = {
    "grade_1": "Grado 1 (leve)", "grade_2": "Grado 2 (moderada)",
    "grade_3": "Grado 3 (severa)", "grade_4": "Grado 4 (muy severa)",
}
_LEVEL_ES = {"low": "Bajo", "medium": "Medio", "high": "Alto", "critical": "Crítico"}


def render_executive_pdf(report: ExecutiveReport) -> bytes:
    """Build the multi-page executive PDF and return it as bytes."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    # ── palette ──────────────────────────────────────────────────────────
    NAVY = colors.HexColor("#0B2545")
    NAVY2 = colors.HexColor("#13315C")
    ACCENT = colors.HexColor("#1B998B")
    LIGHT = colors.HexColor("#F2F4F7")
    MIDGREY = colors.HexColor("#8A94A6")
    LINEGREY = colors.HexColor("#D7DCE3")
    LEVEL_COLOR = {
        "low": colors.HexColor("#2E933C"),
        "medium": colors.HexColor("#E9B949"),
        "high": colors.HexColor("#E76F51"),
        "critical": colors.HexColor("#C1121F"),
    }

    base = getSampleStyleSheet()
    H1 = ParagraphStyle("H1", parent=base["Title"], fontSize=20, textColor=colors.white,
                        leading=24, alignment=TA_LEFT)
    SUB = ParagraphStyle("SUB", parent=base["Normal"], fontSize=10,
                         textColor=colors.white, leading=14)
    H2 = ParagraphStyle("H2", parent=base["Heading2"], fontSize=13, textColor=NAVY,
                        spaceBefore=10, spaceAfter=4)
    BODY = ParagraphStyle("BODY", parent=base["Normal"], fontSize=9, leading=12)
    SMALL = ParagraphStyle("SMALL", parent=base["Normal"], fontSize=7.5,
                           textColor=MIDGREY, leading=10)
    KPIVAL = ParagraphStyle("KPIVAL", parent=base["Normal"], fontSize=17,
                            textColor=NAVY, alignment=TA_CENTER, leading=19)
    KPILBL = ParagraphStyle("KPILBL", parent=base["Normal"], fontSize=7.5,
                            textColor=MIDGREY, alignment=TA_CENTER, leading=9)
    CELL = ParagraphStyle("CELL", parent=base["Normal"], fontSize=8, leading=10)
    CELLC = ParagraphStyle("CELLC", parent=CELL, alignment=TA_CENTER)
    TH = ParagraphStyle("TH", parent=base["Normal"], fontSize=8, leading=10,
                        textColor=colors.white)

    story: List = []

    # ── header band ──────────────────────────────────────────────────────
    header = Table(
        [[Paragraph(f"{report.club_name}", H1)],
         [Paragraph("Informe Ejecutivo de Rendimiento y Salud Deportiva", SUB)],
         [Paragraph(
             f"Periodo: {report.period_from} → {report.period_to} &nbsp;·&nbsp; "
             f"{report.category_label} &nbsp;·&nbsp; Generado: {report.generated_at}",
             SUB)]],
        colWidths=[180 * mm],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (0, 0), 12),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
    ]))
    story.append(header)
    story.append(Spacer(1, 8))

    # ── 1. KPI grid ──────────────────────────────────────────────────────
    story.append(Paragraph("Resumen ejecutivo", H2))
    k = report.kpi
    ppg = "—" if k.points_per_game is None else f"{k.points_per_game:.2f}"
    rating = "—" if k.avg_team_rating is None else f"{k.avg_team_rating:.2f}"
    cards = [
        (str(k.squad_size), "Jugadores"),
        (f"{k.availability_rate:.0f}%", "Disponibilidad"),
        (str(k.active_injuries), "Lesiones activas"),
        (str(k.high_risk_players), "Riesgo alto/crítico"),
        (f"{k.wins}-{k.draws}-{k.losses}", "V-E-D"),
        (ppg, "Puntos / partido"),
        (rating, "Rating medio"),
        (str(k.training_sessions), "Sesiones"),
        (f"{k.total_distance_km:.0f} km", "Distancia total"),
        (f"{k.goals_for}:{k.goals_against}", "Goles F:C"),
    ]
    story.append(_kpi_grid(cards, KPIVAL, KPILBL, Table, TableStyle, colors, mm,
                           LIGHT, LINEGREY))
    story.append(Spacer(1, 6))

    # ── 2. Availability + load charts side by side ───────────────────────
    story.append(Paragraph("Disponibilidad del plantel y carga", H2))
    avail_data = [
        (_STATUS_ES["available"], k.available),
        (_STATUS_ES["injured"], k.injured),
        (_STATUS_ES["recovering"], k.recovering),
        (_STATUS_ES["suspended"], k.suspended),
    ]
    pie = _pie_chart([v for _, v in avail_data if v > 0],
                     [f"{lbl} ({v})" for lbl, v in avail_data if v > 0],
                     colors)
    load_bar = _bar_chart(
        [row["load"] for row in report.load.weekly_trend],
        [row["week"] for row in report.load.weekly_trend],
        ACCENT, colors, "Carga semanal (UA)",
    )
    twocol = Table([[pie or Paragraph("Sin datos de plantel", BODY),
                     load_bar or Paragraph("Sin datos de carga", BODY)]],
                   colWidths=[80 * mm, 100 * mm])
    twocol.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(twocol)
    story.append(Paragraph(
        f"ACWR en zona óptima: {report.load.acwr_optimal_count} jugadores · "
        f"en zona de riesgo (&gt;1.5): {report.load.acwr_danger_count} · "
        f"carga semanal media: {report.load.avg_weekly_load:.0f} UA", SMALL))
    story.append(Spacer(1, 6))

    # ── 3. Injury burden ─────────────────────────────────────────────────
    story.append(Paragraph("Carga lesional", H2))
    inj = report.injuries
    story.append(Paragraph(
        f"<b>{inj.count_in_period}</b> lesiones en el periodo · "
        f"<b>{inj.days_lost}</b> días de baja acumulados · "
        f"promedio <b>{'—' if inj.avg_days_out is None else inj.avg_days_out}</b> días/lesión · "
        f"<b>{inj.surgeries}</b> requirieron cirugía.", BODY))
    story.append(Spacer(1, 4))
    breakdown = Table(
        [[_kv_table("Por zona", inj.by_zone, None, CELL, CELLC, TH, Table,
                    TableStyle, colors, NAVY2, LINEGREY, LIGHT),
          _kv_table("Por mecanismo", inj.by_mechanism, _MECH_ES, CELL, CELLC, TH,
                    Table, TableStyle, colors, NAVY2, LINEGREY, LIGHT),
          _kv_table("Por severidad", inj.by_severity, _SEV_ES, CELL, CELLC, TH,
                    Table, TableStyle, colors, NAVY2, LINEGREY, LIGHT)]],
        colWidths=[60 * mm, 60 * mm, 60 * mm],
    )
    breakdown.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(breakdown)
    month_bar = _bar_chart(
        list(inj.by_month.values()), list(inj.by_month.keys()),
        colors.HexColor("#E76F51"), colors, "Lesiones por mes",
    )
    if month_bar:
        story.append(Spacer(1, 4))
        story.append(month_bar)

    story.append(PageBreak())

    # ── 4. Match performance ─────────────────────────────────────────────
    story.append(Paragraph("Rendimiento en partidos", H2))
    m = report.matches
    story.append(Paragraph(
        f"<b>{len(m.matches)}</b> partidos · <b>{m.wins}V {m.draws}E {m.losses}D</b> · "
        f"goles <b>{m.goals_for}:{m.goals_against}</b> (dif. {m.goal_diff:+d}) · "
        f"<b>{m.points}</b> puntos"
        + ("" if m.points_per_game is None else f" · {m.points_per_game:.2f} pts/partido"),
        BODY))
    story.append(Spacer(1, 4))
    if m.matches:
        rows = [[Paragraph(t, TH) for t in
                 ["Fecha", "Rival", "L/V", "Resultado", "Rating"]]]
        for mr in m.matches[:18]:
            score = ("—" if mr.goals_for is None or mr.goals_against is None
                     else f"{mr.goals_for}-{mr.goals_against}")
            res_es = {"V": "Victoria", "E": "Empate", "D": "Derrota"}.get(mr.result, "—")
            rows.append([
                Paragraph(mr.date, CELL),
                Paragraph(mr.opponent, CELL),
                Paragraph("Local" if mr.home else "Visita", CELLC),
                Paragraph(f"{res_es} {score}", CELLC),
                Paragraph("—" if mr.avg_rating is None else f"{mr.avg_rating:.2f}", CELLC),
            ])
        mt = Table(rows, colWidths=[24 * mm, 70 * mm, 22 * mm, 42 * mm, 22 * mm], repeatRows=1)
        mt.setStyle(_table_style(colors, NAVY2, LINEGREY, LIGHT))
        story.append(mt)
    else:
        story.append(Paragraph("Sin partidos registrados en el periodo.", BODY))
    story.append(Spacer(1, 8))

    # ── 5. Injury-risk outlook (ML) ──────────────────────────────────────
    story.append(Paragraph("Perspectiva de riesgo de lesión (modelo predictivo)", H2))
    if report.risk_outlook:
        rows = [[Paragraph(t, TH) for t in
                 ["Jugador", "Posición", "Riesgo", "Nivel", "Factor principal"]]]
        for it in report.risk_outlook:
            lvl_color = LEVEL_COLOR.get(it.level, MIDGREY)
            factor = it.top_factor or "—"
            if it.top_factor_value is not None:
                factor += f" ({it.top_factor_value})"
            rows.append([
                Paragraph(it.player_name, CELL),
                Paragraph(it.position or "—", CELLC),
                Paragraph(f"{it.score:.0f}", CELLC),
                Paragraph(f'<font color="{lvl_color.hexval()}"><b>'
                          f'{_LEVEL_ES.get(it.level, it.level)}</b></font>', CELLC),
                Paragraph(factor, CELL),
            ])
        rt = Table(rows, colWidths=[52 * mm, 28 * mm, 18 * mm, 22 * mm, 60 * mm], repeatRows=1)
        rt.setStyle(_table_style(colors, NAVY2, LINEGREY, LIGHT))
        story.append(rt)
        story.append(Spacer(1, 3))
        story.append(Paragraph(
            f"Fuente del modelo: {report.model_provenance}. "
            "Las contribuciones provienen de valores SHAP. Un modelo entrenado con "
            "datos sintéticos es un prior orientativo, no un dictamen clínico.", SMALL))
    else:
        story.append(Paragraph("Sin jugadores disponibles para evaluar.", BODY))
    story.append(Spacer(1, 8))

    # ── 6. Recovery ──────────────────────────────────────────────────────
    rec = report.recovery
    if rec.records:
        story.append(Paragraph("Recuperación objetiva (Polar / Garmin)", H2))
        story.append(Paragraph(
            f"{rec.records} registros · HRV medio "
            f"<b>{rec.avg_hrv_rmssd}</b> ms · FC reposo media <b>{rec.avg_resting_hr}</b> lpm · "
            f"sueño medio <b>{rec.avg_sleep_hours}</b> h.", BODY))

    doc_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        doc_buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=14 * mm, bottomMargin=16 * mm,
        title=f"Informe Ejecutivo — {report.club_name}",
        author="Deporte FC",
    )

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setStrokeColor(LINEGREY)
        canvas.setLineWidth(0.5)
        canvas.line(15 * mm, 12 * mm, 195 * mm, 12 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MIDGREY)
        canvas.drawString(15 * mm, 8 * mm,
                          f"{report.club_name} · Confidencial — uso interno de dirección")
        canvas.drawRightString(195 * mm, 8 * mm, f"Página {_doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return doc_buf.getvalue()


# ── flowable / chart helpers ────────────────────────────────────────────────
def _table_style(colors, header_bg, line, zebra):
    from reportlab.platypus import TableStyle
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, zebra]),
        ("GRID", (0, 0), (-1, -1), 0.4, line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])


def _kpi_grid(cards, val_style, lbl_style, Table, TableStyle, colors, mm,
              light, line):
    """5-per-row grid of value/label cards."""
    from reportlab.platypus import Paragraph

    per_row = 5
    grid_rows = []
    for i in range(0, len(cards), per_row):
        chunk = cards[i:i + per_row]
        cell_stack = []
        for value, label in chunk:
            inner = Table([[Paragraph(value, val_style)], [Paragraph(label, lbl_style)]],
                          colWidths=[34 * mm])
            inner.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), light),
                ("BOX", (0, 0), (-1, -1), 0.5, line),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]))
            cell_stack.append(inner)
        while len(cell_stack) < per_row:
            cell_stack.append("")
        grid_rows.append(cell_stack)
    grid = Table(grid_rows, colWidths=[36 * mm] * per_row)
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return grid


def _kv_table(title, data: Dict[str, int], label_map, cell, cellc, th, Table,
              TableStyle, colors, header_bg, line, zebra):
    """Two-column key/value table for an injury breakdown."""
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph

    rows = [[Paragraph(title, th), Paragraph("n", th)]]
    if not data:
        rows.append([Paragraph("Sin datos", cell), Paragraph("—", cellc)])
    else:
        for key, val in data.items():
            label = (label_map or {}).get(key, key.replace("_", " ").capitalize())
            rows.append([Paragraph(label, cell), Paragraph(str(val), cellc)])
    t = Table(rows, colWidths=[44 * mm, 12 * mm])
    t.setStyle(_table_style(colors, header_bg, line, zebra))
    return t


def _bar_chart(values, labels, bar_color, colors, title):
    """Vertical bar chart Drawing, or None if there's nothing to plot."""
    if not values or sum(values) <= 0:
        return None
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.shapes import Drawing, String

    width, height = 96 * 2.6, 150
    d = Drawing(width, height)
    chart = VerticalBarChart()
    chart.x, chart.y = 28, 22
    chart.width = width - 40
    chart.height = height - 48
    chart.data = [list(values)]
    chart.bars[0].fillColor = bar_color
    chart.bars.strokeColor = None
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 6
    chart.categoryAxis.categoryNames = [str(x) for x in labels]
    chart.categoryAxis.labels.fontSize = 6
    chart.categoryAxis.labels.angle = 30
    chart.categoryAxis.labels.dy = -6
    chart.categoryAxis.labels.boxAnchor = "ne"
    d.add(chart)
    d.add(String(4, height - 12, title, fontSize=8,
                 fillColor=colors.HexColor("#0B2545")))
    d.hAlign = "CENTER"
    return d


def _pie_chart(values, labels, colors):
    """Pie chart Drawing for squad availability, or None if empty."""
    if not values or sum(values) <= 0:
        return None
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.shapes import Drawing, String

    palette = [colors.HexColor("#2E933C"), colors.HexColor("#C1121F"),
               colors.HexColor("#E9B949"), colors.HexColor("#8A94A6"),
               colors.HexColor("#1B998B")]
    d = Drawing(190, 150)
    pie = Pie()
    pie.x, pie.y = 18, 18
    pie.width = pie.height = 108
    pie.data = list(values)
    pie.labels = list(labels)
    pie.sideLabels = True
    pie.slices.strokeColor = colors.white
    pie.slices.strokeWidth = 1
    for i in range(len(values)):
        pie.slices[i].fontSize = 7
        pie.slices[i].fillColor = palette[i % len(palette)]
    d.add(pie)
    d.add(String(4, 138, "Estado del plantel", fontSize=8,
                 fillColor=colors.HexColor("#0B2545")))
    d.hAlign = "CENTER"
    return d
