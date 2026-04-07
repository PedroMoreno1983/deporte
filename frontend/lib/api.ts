import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, null, {
            params: { token: refreshToken },
          });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const playersApi = {
  list: (params?: { category_id?: number; status?: string; search?: string }) =>
    api.get("/players", { params }).then((r) => r.data),
  get: (id: number) => api.get(`/players/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post("/players", data).then((r) => r.data),
  update: (id: number, data: unknown) =>
    api.patch(`/players/${id}`, data).then((r) => r.data),
};

export const categoriesApi = {
  list: () => api.get("/categories").then((r) => r.data),
};

export const kinesiologyApi = {
  getByPlayer: (playerId: number) =>
    api.get(`/kinesiology/player/${playerId}`).then((r) => r.data),
  create: (data: unknown) => api.post("/kinesiology", data).then((r) => r.data),
};

export const injuriesApi = {
  getByPlayer: (playerId: number) =>
    api.get(`/injuries/player/${playerId}`).then((r) => r.data),
  getActive: () => api.get("/injuries/active").then((r) => r.data),
  create: (data: unknown) => api.post("/injuries", data).then((r) => r.data),
  update: (id: number, data: unknown) =>
    api.patch(`/injuries/${id}`, data).then((r) => r.data),
};

export const matchesApi = {
  list: (params?: { category_id?: number }) =>
    api.get("/matches", { params }).then((r) => r.data),
  create: (data: unknown) => api.post("/matches", data).then((r) => r.data),
  getStats: (matchId: number) =>
    api.get(`/matches/${matchId}/stats`).then((r) => r.data),
  createStat: (data: unknown) =>
    api.post("/matches/stats", data).then((r) => r.data),
  getPlayerStats: (playerId: number) =>
    api.get(`/matches/player/${playerId}/stats`).then((r) => r.data),
};

export const trainingApi = {
  getByPlayer: (playerId: number, params?: { start_date?: string; end_date?: string }) =>
    api.get(`/training/player/${playerId}`, { params }).then((r) => r.data),
  create: (data: unknown) => api.post("/training", data).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: (categoryId?: number) =>
    api.get("/analytics/dashboard", { params: { category_id: categoryId } }).then((r) => r.data),
  playerSummary: (playerId: number) =>
    api.get(`/analytics/player/${playerId}/summary`).then((r) => r.data),
  injuryStats: () => api.get("/analytics/injuries/stats").then((r) => r.data),
};

export const wellnessApi = {
  create:      (data: unknown) => api.post("/wellness", data).then((r) => r.data),
  getByPlayer: (playerId: number, days = 30) =>
    api.get(`/wellness/player/${playerId}`, { params: { days } }).then((r) => r.data),
  teamSummary: (targetDate?: string, categoryId?: number) =>
    api.get("/wellness/team/summary", { params: { target_date: targetDate, category_id: categoryId } }).then((r) => r.data),
  teamTrend: (days = 14) =>
    api.get("/wellness/team/trend", { params: { days } }).then((r) => r.data),
};

export const tacticalApi = {
  list:   ()              => api.get("/tactical/").then((r) => r.data),
  create: (data: unknown) => api.post("/tactical/", data).then((r) => r.data),
  delete: (id: number)    => api.delete(`/tactical/${id}`).then((r) => r.data),
};

export const predictionsApi = {
  getForPlayer: (playerId: number) =>
    api.get(`/predictions/player/${playerId}`).then((r) => r.data),
  teamRisk: () => api.get("/predictions/team/risk-summary").then((r) => r.data),
};

// --- AI Tactical ---
export const aiTacticalApi = {
  recommend: (data: unknown) => api.post("/tactical/recommend", data).then((r) => r.data),
};
