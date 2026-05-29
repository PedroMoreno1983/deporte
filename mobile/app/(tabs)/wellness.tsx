import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { wellnessApi } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";

const SCORE_COLOR = (s: number | null) => {
  if (s == null) return "rgba(255,255,255,0.25)";
  if (s >= 7.5) return "#00ff87";
  if (s >= 5)   return "#f59e0b";
  return "#ff3b30";
};

export default function WellnessScreen() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["wellness-team"],
    queryFn:  () => wellnessApi.teamSummary(),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00ff87" />
      </View>
    );
  }

  const score = summary?.avg_score ?? null;
  const responded = summary?.responded ?? 0;
  const total = summary?.total_players ?? 0;
  const pct = total > 0 ? Math.round((responded / total) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Wellness</Text>
        <Text style={styles.subtitle}>Estado anímico y físico — hoy</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={[styles.heroScore, { color: SCORE_COLOR(score) }]}>
            {score != null ? score.toFixed(1) : "—"}
          </Text>
          <Text style={styles.heroLabel}>Score del equipo</Text>
        </View>
        <View style={styles.heroRight}>
          <Text style={styles.heroValue}>{responded}/{total}</Text>
          <Text style={styles.heroLabel}>completaron ({pct}%)</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: "#00ff87" }]} />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Plantel</Text>
      {(summary?.entries ?? []).map((e: any) => (
        <View key={e.player_id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: e.has_entry ? SCORE_COLOR(e.wellness_score) : "rgba(255,255,255,0.15)" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName}>{e.player_name}</Text>
            <Text style={styles.playerMeta}>
              {e.has_entry ? `${e.wellness_score?.toFixed(1)} / 10` : "Sin registro"}
            </Text>
          </View>
          {e.alert && <Ionicons name="warning" size={16} color="#ff3b30" />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 16 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },
  header:    { marginTop: 48, marginBottom: 16 },
  title:     { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle:  { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  heroCard:  { flexDirection: "row", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(0,255,135,0.18)", backgroundColor: "rgba(0,255,135,0.05)", marginBottom: 16 },
  heroLeft:  { alignItems: "center", justifyContent: "center" },
  heroRight: { flex: 1, justifyContent: "center" },
  heroScore: { fontSize: 40, fontWeight: "800" },
  heroValue: { fontSize: 20, fontWeight: "700", color: "#fff" },
  heroLabel: { fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginTop: 2 },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  playerMeta: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 },
});
