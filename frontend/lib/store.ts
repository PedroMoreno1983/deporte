import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "coach" | "kinesiologist" | "analyst";
  avatar_url?: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        set({ user, accessToken, refreshToken });
      },
      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, accessToken: null, refreshToken: null });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: "auth-store", partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
);
