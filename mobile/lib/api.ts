import axios from "axios";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const playersApi = {
  list: (params?: { category_id?: number; status?: string; search?: string }) =>
    api.get("/players", { params }).then((r) => r.data),
  get: (id: number) => api.get(`/players/${id}`).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: (categoryId?: number) =>
    api.get("/analytics/dashboard", { params: { category_id: categoryId } }).then((r) => r.data),
  playerSummary: (playerId: number) =>
    api.get(`/analytics/player/${playerId}/summary`).then((r) => r.data),
};

export const injuriesApi = {
  getActive: () => api.get("/injuries/active").then((r) => r.data),
  getByPlayer: (playerId: number) =>
    api.get(`/injuries/player/${playerId}`).then((r) => r.data),
};

export const predictionsApi = {
  teamRisk: () => api.get("/predictions/team/risk-summary").then((r) => r.data),
  getForPlayer: (playerId: number) =>
    api.get(`/predictions/player/${playerId}`).then((r) => r.data),
};
