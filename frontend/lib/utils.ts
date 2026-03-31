import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero",
  center_back: "Defensa Central",
  left_back: "Lateral Izq.",
  right_back: "Lateral Der.",
  defensive_mid: "Mediocampista Def.",
  central_mid: "Mediocampista",
  attacking_mid: "Mediocampista Of.",
  left_wing: "Extremo Izq.",
  right_wing: "Extremo Der.",
  center_forward: "Delantero",
};

export const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  injured: "Lesionado",
  suspended: "Suspendido",
  recovering: "Recuperación",
  inactive: "Inactivo",
};

export const STATUS_COLORS: Record<string, string> = {
  available: "text-emerald-400 bg-emerald-400/10",
  injured: "text-red-400 bg-red-400/10",
  suspended: "text-yellow-400 bg-yellow-400/10",
  recovering: "text-orange-400 bg-orange-400/10",
  inactive: "text-gray-400 bg-gray-400/10",
};

export const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
};

export const RISK_LABELS: Record<string, string> = {
  low: "Bajo",
  medium: "Moderado",
  high: "Alto",
  critical: "Crítico",
};

export function formatAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function formatDistance(meters: number | null): string {
  if (!meters) return "-";
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}
