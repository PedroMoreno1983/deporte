import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const C = {
  neon: "#00c96a", dark: "#0a0f1e", surface: "#111827",
  card: "#1a2235", border: "#1e293b", muted: "#64748b",
  white: "#ffffff", danger: "#ff3b30", warn: "#f59e0b",
  blue: "#0ea5e9", purple: "#a855f7",
};

const s = StyleSheet.create({
  page:         { backgroundColor: C.dark, padding: 36, fontFamily: "Helvetica" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  clubBadge:    { backgroundColor: C.neon, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  clubText:     { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.dark, letterSpacing: 1.5 },
  headerRight:  { alignItems: "flex-end" },
  docTitle:     { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  dateText:     { fontSize: 7, color: C.muted },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 1.2, marginBottom: 8 },
  section:      { marginBottom: 18 },
  kpiRow:       { flexDirection: "row", gap: 8, marginBottom: 18 },
  kpiCard:      { flex: 1, backgroundColor: C.card, borderRadius: 8, padding: 12, alignItems: "center", borderWidth: 1, borderColor: C.border },
  kpiValue:     { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 2 },
  kpiLabel:     { fontSize: 7, color: C.muted },
  table:        { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  tableHead:    { flexDirection: "row", backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 6 },
  tableRow:     { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border },
  thCell:       { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, letterSpacing: 0.8 },
  tdCell:       { fontSize: 8, color: C.white },
  tdMuted:      { fontSize: 8, color: C.muted },
  badge:        { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText:    { fontSize: 7, fontFamily: "Helvetica-Bold" },
  injItem:      { flexDirection: "row", alignItems: "flex-start", padding: 10, backgroundColor: C.card, borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: "#ff3b3020" },
  injDot:       { width: 7, height: 7, borderRadius: 4, marginRight: 8, marginTop: 2 },
  injText:      { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 2 },
  injMeta:      { fontSize: 7, color: C.muted },
  footer:       { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  footerText:   { fontSize: 6, color: C.muted },
  barTrack:     { height: 4, backgroundColor: "#1e293b", borderRadius: 2, overflow: "hidden", flex: 1 },
  barFill:      { height: 4, borderRadius: 2 },
});

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  available:  { label: "Disponible",   color: C.neon,    bg: "#00c96a20" },
  injured:    { label: "Lesionado",    color: C.danger,  bg: "#ff3b3020" },
  recovering: { label: "Recuperación", color: "#f97316", bg: "#f9731620" },
  suspended:  { label: "Suspendido",   color: C.warn,    bg: "#f59e0b20" },
  inactive:   { label: "Inactivo",     color: C.muted,   bg: "#64748b20" },
};
const SEV_COLORS: Record<string, string> = {
  grade_1: C.neon, grade_2: C.warn, grade_3: "#f97316", grade_4: C.danger,
};
const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "POR", center_back: "DEF", left_back: "LI", right_back: "LD",
  defensive_mid: "MCD", central_mid: "MC", attacking_mid: "MCO",
  left_wing: "EI", right_wing: "ED", center_forward: "DC",
};
const RISK_COLOR: Record<string, string> = {
  low: C.neon, medium: C.warn, high: "#f97316", critical: C.danger,
};

interface Props {
  players: any[];
  activeInjuries: any[];
  teamStats?: any;
  categoryName?: string;
}

export function TeamReportPDF({ players, activeInjuries, teamStats, categoryName }: Props) {
  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const available = players.filter((p: any) => p.status === "available").length;
  const injured = players.filter((p: any) => p.status === "injured" || p.status === "recovering").length;

  return (
    <Document title="Reporte de Equipo — Deporte FC" author="Deporte FC Platform">
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <View>
            <View style={s.clubBadge}>
              <Text style={s.clubText}>DEPORTE FC</Text>
            </View>
            <Text style={[s.docTitle, { marginTop: 6, color: C.muted }]}>
              REPORTE DE EQUIPO{categoryName ? `  —  ${categoryName}` : ""}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>GENERADO</Text>
            <Text style={s.dateText}>{today}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          {[
            { label: "Total jugadores", value: players.length,      color: C.white  },
            { label: "Disponibles",     value: available,           color: C.neon   },
            { label: "Lesionados",      value: injured,             color: C.danger },
            { label: "Lesiones activas",value: activeInjuries.length, color: C.warn },
          ].map(({ label, value, color }) => (
            <View key={label} style={s.kpiCard}>
              <Text style={[s.kpiValue, { color }]}>{value}</Text>
              <Text style={s.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* PLAYER TABLE */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PLANTEL COMPLETO</Text>
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.thCell, { width: 18 }]}>#</Text>
              <Text style={[s.thCell, { flex: 3 }]}>JUGADOR</Text>
              <Text style={[s.thCell, { flex: 1.5 }]}>POS.</Text>
              <Text style={[s.thCell, { flex: 2 }]}>ESTADO</Text>
              <Text style={[s.thCell, { flex: 1.5 }]}>RIESGO</Text>
            </View>
            {players.map((p: any, i: number) => {
              const stCfg = STATUS_CFG[p.status] ?? STATUS_CFG.inactive;
              const pred = p.latest_prediction;
              const riskColor = pred ? RISK_COLOR[pred.injury_risk_level] ?? C.muted : C.muted;
              return (
                <View key={p.id} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? "transparent" : "#ffffff05" }]}>
                  <Text style={[s.tdMuted, { width: 18 }]}>{p.jersey_number ?? "—"}</Text>
                  <Text style={[s.tdCell, { flex: 3 }]}>{p.first_name} {p.last_name}</Text>
                  <Text style={[s.tdMuted, { flex: 1.5 }]}>{POSITION_LABELS[p.position] ?? p.position}</Text>
                  <View style={[s.badge, { flex: 2, backgroundColor: stCfg.bg }]}>
                    <Text style={[s.badgeText, { color: stCfg.color }]}>{stCfg.label}</Text>
                  </View>
                  <Text style={[s.badgeText, { flex: 1.5, color: riskColor }]}>
                    {pred ? `${pred.injury_risk_score?.toFixed(0) ?? "—"}% ${pred.injury_risk_level === "critical" ? "⚠" : ""}` : "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ACTIVE INJURIES */}
        {activeInjuries.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>LESIONES ACTIVAS — {activeInjuries.length} JUGADORES FUERA</Text>
            {activeInjuries.map((inj: any) => {
              const sevColor = SEV_COLORS[inj.severity] ?? C.muted;
              return (
                <View key={inj.id} style={s.injItem}>
                  <View style={[s.injDot, { backgroundColor: sevColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.injText}>{inj.player_name ?? `Jugador #${inj.player_id}`}</Text>
                    <Text style={s.injMeta}>
                      {inj.injury_type}  ·  {(inj.body_zone ?? "").replace(/_/g, " ")}  ·  {inj.injury_date}
                      {inj.estimated_days_out ? `  ·  ${inj.estimated_days_out} días estimados` : ""}
                    </Text>
                  </View>
                  <Text style={[s.badgeText, { color: sevColor }]}>{inj.severity?.replace("grade_", "G")}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* FOOTER */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Deporte FC · Plataforma de Gestión Deportiva</Text>
          <Text style={s.footerText}>Confidencial — Uso interno</Text>
          <Text render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`} style={s.footerText} />
        </View>

      </Page>
    </Document>
  );
}
