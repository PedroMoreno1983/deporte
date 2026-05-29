import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { playersApi } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero", center_back: "Def. Central", left_back: "Lat. Izq.",
  right_back: "Lat. Der.", defensive_mid: "MC Def.", central_mid: "MC",
  attacking_mid: "MC Of.", left_wing: "Ext. Izq.", right_wing: "Ext. Der.", center_forward: "Delantero",
};
const STATUS_COLORS: Record<string, string> = {
  available: "#00ff87", injured: "#ff3b30", recovering: "#f97316",
  suspended: "#f59e0b", inactive: "#6b7280",
};

export default function PlayersScreen() {
  const [search, setSearch] = useState("");
  const { data: players, isLoading } = useQuery({
    queryKey: ["players", search],
    queryFn: () => playersApi.list({ search: search || undefined }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jugadores</Text>
        <Text style={styles.count}>{players?.length ?? 0} registrados</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.3)" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar jugador..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.searchInput}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {players?.map((player: {
          id: number; first_name: string; last_name: string;
          jersey_number?: number; position: string; status: string;
        }) => (
          <View key={player.id} style={styles.playerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {player.first_name.charAt(0)}{player.last_name.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>
                {player.first_name} {player.last_name}
                {player.jersey_number ? ` #${player.jersey_number}` : ""}
              </Text>
              <Text style={styles.playerPos}>{POSITION_LABELS[player.position] || player.position}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[player.status] }]} />
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", paddingHorizontal: 16, paddingTop: 56 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#fff" },
  count: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  playerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#00ff87", fontWeight: "700", fontSize: 13 },
  playerName: { color: "#fff", fontWeight: "600", fontSize: 14 },
  playerPos: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
