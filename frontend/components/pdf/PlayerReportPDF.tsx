import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";

// ── Styles ────────────────────────────────────────────────────────────────────
const C = {
  neon:    "#00c96a",
  dark:    "#0a0f1e",
  surface: "#111827",
  card:    "#1a2235",
  border:  "#1e293b",
  muted:   "#64748b",
  white:   "#ffffff",
  danger:  "#ff3b30",
  warn:    "#f59e0b",
  blue:    "#0ea5e9",
  purple:  "#a855f7",
};

const s = StyleSheet.create({
  page:        { backgroundColor: C.dark, padding: 36, fontFamily: "Helvetica" },
  // Header
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  clubBadge:   { backgroundColor: C.neon, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  clubText:    { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.dark, letterSpacing: 1.5 },
  headerRight: { alignItems: "flex-end" },
  docTitle:    { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  dateText:    { fontSize: 7, color: C.muted },
  // Player hero
  hero:        { flexDirection: "row", gap: 16, marginBottom: 20, padding: 16, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  avatar:      { width: 56, height: 56, borderRadius: 8, backgroundColor: C.surface, borderWidth: 2, borderColor: C.neon, alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.neon },
  heroInfo:    { flex: 1 },
  playerName:  { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 4 },
  playerSub:   { fontSize: 9, color: C.muted, marginBottom: 6 },
  badge:       { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 0 },
  badgeText:   { fontSize: 8, fontFamily: "Helvetica-Bold" },
  riskBlock:   { alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  riskScore:   { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  riskLabel:   { fontSize: 7, color: C.muted, letterSpacing: 0.8 },
  // Section
  section:     { marginBottom: 16 },
  sectionTitle:{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" },
  // KPI row
  kpiRow:      { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard:     { flex: 1, backgroundColor: C.card, borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: C.border },
  kpiValue:    { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 2 },
  kpiLabel:    { fontSize: 7, color: C.muted },
  // Table
  table:       { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  tableHead:   { flexDirection: "row", backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 6 },
  tableRow:    { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  thCell:      { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 0.8 },
  tdCell:      { fontSize: 8, color: C.white },
  tdMuted:     { fontSize: 8, color: C.muted },
  // Bar
  barRow:      { marginBottom: 8 },
  barLabel:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  barTrack:    { height: 5, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden" },
  barFill:     { height: 5, borderRadius: 3 },
  // Injury item
  injuryItem:  { flexDirection: "row", alignItems: "flex-start", padding: 10, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: "#ff3b3025", marginBottom: 6 },
  injDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 2 },
  injContent:  { flex: 1 },
  injType:     { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 2 },
  injMeta:     { fontSize: 7, color: C.muted },
  // Footer
  footer:      { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  footerText:  { fontSize: 6, color: C.muted },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEV_COLORS: Record<string, string> = {
  grade_1: C.neon, grade_2: C.warn, grade_3: "#f97316", grade_4: C.danger,
};
const SEV_LABELS: Record<string, string> = {
  grade_1: "Grado I — Leve", grade_2: "Grado II — Moderado",
  grade_3: "Grado III — Severo", grade_4: "Grado IV — Quirúrgico",
};
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: "Disponible",   color: C.neon,    bg: "#00c96a20" },
  injured:    { label: "Lesionado",    color: C.danger,  bg: "#ff3b3020" },
  recovering: { label: "Recuperación", color: "#f97316", bg: "#f9731620" },
  suspended:  { label: "Suspendido",   color: C.warn,    bg: "#f59e0b20" },
  inactive:   { label: "Inactivo",     color: C.muted,   bg: "#64748b20" },
};
const RISK_COLOR: Record<string, string> = {
  low: C.neon, medium: C.warn, high: "#f97316", critical: C.danger,
};
const RISK_LABEL: Record<string, string> = {
  low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
};
const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero", center_back: "Defensa Central",
  left_back: "Lateral Izq.", right_back: "Lateral Der.",
  defensive_mid: "Mediocampista Def.", central_mid: "Mediocampista",
  attacking_mid: "Mediocampista Of.", left_wing: "Extremo Izq.",
  right_wing: "Extremo Der.", center_forward: "Delantero Centro",
};

function Bar({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  return (
    <View style={s.barRow}>
      <View style={s.barLabel}>
        <Text style={{ fontSize: 8, color: C.white }}>{label}</Text>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color }}>{sub ?? `${value.toFixed(0)}/100`}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.min(value, 100)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────
interface Props {
  player: any;
  summary: any;
  prediction: any;
  kinesiology: any[];
  injuries: any[];
  wellness: any[];
}

export function PlayerReportPDF({ player, summary, prediction, kinesiology, injuries, wellness }: Props) {
  const statusCfg = STATUS_CFG[player?.status] ?? STATUS_CFG.inactive;
  const latestKinesio = kinesiology?.[0];
  const activeInjuries = injuries?.filter((i: any) => !i.is_recovered) ?? [];
  const allInjuries = injuries ?? [];
  const latestWellness = wellness?.[0];
  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

  const initials = player
    ? `${player.first_name?.charAt(0) ?? ""}${player.last_name?.charAt(0) ?? ""}`
    : "?";

  const riskScore = prediction?.injury_risk_score ?? 0;
  const riskLevel = prediction?.injury_risk_level ?? "low";
  const riskColor = RISK_COLOR[riskLevel] ?? C.neon;

  return (
    <Document title={`Reporte ${player?.first_name} ${player?.last_name}`} author="Deporte FC Platform">
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View>
            <View style={s.clubBadge}>
              <Text style={s.clubText}>DEPORTE FC</Text>
            </View>
            <Text style={[s.playerSub, { marginTop: 6 }]}>REPORTE INDIVIDUAL DE JUGADOR</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>GENERADO</Text>
            <Text style={s.dateText}>{today}</Text>
          </View>
        </View>

        {/* ── PLAYER HERO ── */}
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.heroInfo}>
            <Text style={s.playerName}>{player?.first_name} {player?.last_name}</Text>
            <Text style={s.playerSub}>
              {player?.jersey_number ? `#${player.jersey_number}  ·  ` : ""}
              {POSITION_LABELS[player?.position] ?? player?.position}
              {player?.category?.name ? `  ·  ${player.category.name}` : ""}
              {player?.date_of_birth ? `  ·  ${new Date().getFullYear() - new Date(player.date_of_birth).getFullYear()} años` : ""}
            </Text>
            <View style={[s.badge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[s.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>
          {prediction && (
            <View style={s.riskBlock}>
              <Text style={[s.riskScore, { color: riskColor }]}>{riskScore.toFixed(0)}%</Text>
              <Text style={s.riskLabel}>RIESGO {RISK_LABEL[riskLevel]?.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* ── KPIs ── */}
        <View style={s.kpiRow}>
          {[
            { label: "Partidos",       value: summary?.matches ?? 0,                color: C.blue   },
            { label: "Goles",          value: summary?.goals ?? 0,                  color: C.neon   },
            { label: "Asistencias",    value: summary?.assists ?? 0,               color: C.warn   },
            { label: "Rating prom.",   value: summary?.avg_rating?.toFixed(1) ?? "—", color: "#f97316", raw: true },
            { label: "Lesiones hist.", value: summary?.total_injuries ?? 0,         color: C.danger },
          ].map(({ label, value, color, raw }: any) => (
            <View key={label} style={s.kpiCard}>
              <Text style={[s.kpiValue, { color }]}>{raw ? value : value}</Text>
              <Text style={s.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── PHYSICAL PROFILE ── */}
        {latestKinesio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Perfil Físico{latestKinesio.assessment_date ? `  —  Evaluación: ${latestKinesio.assessment_date}` : ""}</Text>
            {latestKinesio.squat_1rm_kg && (
              <Bar value={(latestKinesio.squat_1rm_kg / 150) * 100} color={C.neon}
                label="Squat 1RM" sub={`${latestKinesio.squat_1rm_kg} kg`} />
            )}
            {latestKinesio.sprint_30m_sec && (
              <Bar value={Math.max(100 - (latestKinesio.sprint_30m_sec - 3.5) * 50, 0)} color={C.blue}
                label="Sprint 30m" sub={`${latestKinesio.sprint_30m_sec}s`} />
            )}
            {latestKinesio.cmj_height_cm && (
              <Bar value={(latestKinesio.cmj_height_cm / 60) * 100} color={C.warn}
                label="CMJ Height" sub={`${latestKinesio.cmj_height_cm} cm`} />
            )}
            {latestKinesio.vo2_max && (
              <Bar value={(latestKinesio.vo2_max / 65) * 100} color={C.purple}
                label="VO₂ Máx" sub={`${latestKinesio.vo2_max}`} />
            )}
          </View>
        )}

        {/* ── WELLNESS LAST ENTRY ── */}
        {latestWellness && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Último Registro Wellness  —  {latestWellness.entry_date ?? latestWellness.date ?? ""}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                {latestWellness.sleep_quality != null && (
                  <Bar value={(latestWellness.sleep_quality / 10) * 100} color={C.blue}
                    label="Sueño" sub={`${latestWellness.sleep_quality}/10`} />
                )}
                {latestWellness.fatigue != null && (
                  <Bar value={(latestWellness.fatigue / 10) * 100} color={C.neon}
                    label="Energía/Fatiga" sub={`${latestWellness.fatigue}/10`} />
                )}
                {latestWellness.mood != null && (
                  <Bar value={(latestWellness.mood / 10) * 100} color={C.warn}
                    label="Ánimo" sub={`${latestWellness.mood}/10`} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                {latestWellness.stress != null && (
                  <Bar value={100 - (latestWellness.stress / 10) * 100} color={C.purple}
                    label="Nivel de estrés (inv.)" sub={`${latestWellness.stress}/10`} />
                )}
                {latestWellness.muscle_soreness != null && (
                  <Bar value={100 - (latestWellness.muscle_soreness / 10) * 100} color="#f97316"
                    label="Dolor muscular (inv.)" sub={`${latestWellness.muscle_soreness}/10`} />
                )}
                {latestWellness.wellness_score != null && (
                  <Bar value={latestWellness.wellness_score} color={C.neon}
                    label="Score global" sub={`${latestWellness.wellness_score.toFixed(0)}/100`} />
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── ACTIVE INJURIES ── */}
        {activeInjuries.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Lesiones Activas  —  {activeInjuries.length} en curso</Text>
            {activeInjuries.map((inj: any) => {
              const sevColor = SEV_COLORS[inj.severity] ?? C.muted;
              return (
                <View key={inj.id} style={s.injuryItem}>
                  <View style={[s.injDot, { backgroundColor: sevColor }]} />
                  <View style={s.injContent}>
                    <Text style={s.injType}>{inj.injury_type}</Text>
                    <Text style={s.injMeta}>
                      {SEV_LABELS[inj.severity]}  ·  {(inj.body_zone ?? "").replace(/_/g, " ")}  ·  {inj.injury_date}
                      {inj.estimated_days_out ? `  ·  ${inj.estimated_days_out} días estimados` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── INJURY HISTORY TABLE ── */}
        {allInjuries.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Historial de Lesiones ({allInjuries.length} registros)</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                {["Lesión", "Zona", "Severidad", "Fecha", "Días"].map((h, i) => (
                  <Text key={h} style={[s.thCell, { flex: i === 0 ? 2 : 1 }]}>{h}</Text>
                ))}
              </View>
              {allInjuries.slice(0, 8).map((inj: any) => (
                <View key={inj.id} style={[s.tableRow, { backgroundColor: !inj.is_recovered ? "#ff3b300a" : "transparent" }]}>
                  <Text style={[s.tdCell, { flex: 2 }]}>{inj.injury_type}</Text>
                  <Text style={[s.tdMuted, { flex: 1 }]}>{(inj.body_zone ?? "").replace(/_/g, " ")}</Text>
                  <Text style={[s.tdMuted, { flex: 1, color: SEV_COLORS[inj.severity] ?? C.muted }]}>
                    {inj.severity?.replace("grade_", "G")}
                  </Text>
                  <Text style={[s.tdMuted, { flex: 1 }]}>{inj.injury_date}</Text>
                  <Text style={[s.tdMuted, { flex: 1 }]}>{inj.estimated_days_out ?? "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Deporte FC · Plataforma de Gestión Deportiva</Text>
          <Text style={s.footerText}>Confidencial — Uso interno</Text>
          <Text render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`} style={s.footerText} />
        </View>

      </Page>
    </Document>
  );
}
