import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";
import { Users, AlertTriangle, Trophy, HeartPulse } from "lucide-react";

const meta: Meta<typeof StatCard> = {
  title: "Cards/StatCard",
  component: StatCard,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof StatCard>;

export const TotalPlayers:    Story = { args: { label: "Jugadores",          value: 28,  icon: Users,          color: "#00ff87" } };
export const ActiveInjuries:  Story = { args: { label: "Lesiones activas",   value: 3,   icon: AlertTriangle,  color: "#ff3b30" } };
export const RecentMatches:   Story = { args: { label: "Partidos (30d)",     value: 5,   icon: Trophy,         color: "#f59e0b" } };
export const AvailabilityPct: Story = { args: { label: "Disponibilidad",     value: 82.5, icon: HeartPulse,    color: "#0ea5e9", suffix: "%" } };
export const WithTrend:       Story = { args: {
  label: "Goles",
  value: 12,
  icon: Trophy,
  color: "#00ff87",
  trend: { value: 15, label: "vs prev." },
} };
