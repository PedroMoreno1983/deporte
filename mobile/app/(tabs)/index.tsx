import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, predictionsApi } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";

const RISK_COLORS: Record<string, string> = {
  low: "#00ff87",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ff3b30",
};
const RISK_LABELS: Record<string, string> = {
  low: "Bajo", medium: "Moderado", high: "Alto", critical: "Crítico"
};

function KpiCard({ label, value, icon, color = "#00ff87" }: {
  label: string; value: string | number; icon: string; color?: string
}) {
  return (
    <View style={[styles.kpiCard, { borderColor: `${color}20` }]}>
      <Ionicons name={icon as any} size={20} color={color} style={{ marginBottom: 8 }} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => analyticsApi.dashboard(),
  });

  const { data: teamRisk } = useQuery({
    queryKey: ["team-risk"],
    queryFn: () => predictionsApi.teamRisk(),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00ff87" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  const topRisk = teamRisk?.slice(0, 5) ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Deporte FC</Text>
        <Text style={styles.subtitle}>Resumen del equipo</Text>
      </View>

      <View style={styles.kpiGrid}>
        <KpiCard label="Jugadores" value={dash?.total_players ?? 0} icon="people-outline" />
        <KpiCard label="Disponibles" value={dash?.available ?? 0} icon="checkmark-circle-outline" color="#00ff87" />
        <KpiCard label="Lesionados" value={dash?.injured ?? 0} icon="medkit-outline" color="#ff3b30" />
        <KpiCard label="Disponibilidad" value={`${dash?.availability_rate ?? 0}%`} icon="stats-chart-outline" color="#3b82f6" />
      </View>

      {topRisk.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerta de riesgo</Text>
          {topRisk.map((p: { player_id: number; player_name: string; risk_score: number; risk_level: string }) => (
            <View key={p.player_id} style={styles.riskRow}>
              <View style={[styles.riskBadge, { backgroundColor: `${RISK_COLORS[p.risk_level]}15`, borderColor: `${RISK_COLORS[p.risk_level]}30` }]}>
                <Text style={[styles.riskScore, { color: RISK_COLORS[p.risk_level] }]}>{p.risk_score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{p.player_name}</Text>
                <Text style={[styles.riskLabel, { color: RISK_COLORS[p.risk_level] }]}>
                  Riesgo {RISK_LABELS[p.risk_level]}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  header: { marginTop: 48, marginBottom: 20 },
  greeting: { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  kpiCard: {
    width: "48%", padding: 16, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
  },
  kpiValue: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: "600" },
  section: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#fff", marginBottom: 12 },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  riskBadge: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  riskScore: { fontSize: 14, fontWeight: "700" },
  playerName: { fontSize: 13, fontWeight: "600", color: "#fff" },
  riskLabel: { fontSize: 11, fontWeight: "500", marginTop: 1 },
});
