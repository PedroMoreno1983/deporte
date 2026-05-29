"use client";
/**
 * Frontend permission helpers — mirrors backend `core/permissions.py`.
 * The source of truth is the backend response from /auth/me/permissions;
 * the static role table below is only a fallback for offline UX hints.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "./store";
import { authApi } from "./api";

export type Permission =
  | "players:read" | "players:write" | "players:delete"
  | "injuries:read" | "injuries:write"
  | "wellness:read" | "wellness:write"
  | "matches:read" | "matches:write"
  | "training:read" | "training:write"
  | "tactical:read" | "tactical:write"
  | "predictions:read"
  | "analytics:read"
  | "users:manage"
  | "categories:manage"
  | "audit:read";

const ROLE_FALLBACK: Record<string, Permission[]> = {
  admin: [
    "players:read", "players:write", "players:delete",
    "injuries:read", "injuries:write",
    "wellness:read", "wellness:write",
    "matches:read", "matches:write",
    "training:read", "training:write",
    "tactical:read", "tactical:write",
    "predictions:read", "analytics:read",
    "users:manage", "categories:manage", "audit:read",
  ],
  coach: [
    "players:read", "players:write",
    "injuries:read",
    "wellness:read", "wellness:write",
    "matches:read", "matches:write",
    "training:read", "training:write",
    "tactical:read", "tactical:write",
    "predictions:read", "analytics:read",
  ],
  kinesiologist: [
    "players:read",
    "injuries:read", "injuries:write",
    "wellness:read", "wellness:write",
    "training:read",
    "predictions:read",
  ],
  analyst: [
    "players:read",
    "injuries:read",
    "matches:read",
    "training:read",
    "tactical:read",
    "predictions:read", "analytics:read",
  ],
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ["my-permissions"],
    queryFn:  () => authApi.permissions(),
    enabled:  !!user,
    staleTime: 60 * 60 * 1000,
  });

  const set = new Set<string>(
    (data?.permissions as string[]) ?? (user ? ROLE_FALLBACK[user.role] ?? [] : []),
  );

  function can(permission: Permission | Permission[]): boolean {
    if (Array.isArray(permission)) return permission.some((p) => set.has(p));
    return set.has(permission);
  }
  function canAll(permissions: Permission[]): boolean {
    return permissions.every((p) => set.has(p));
  }
  return { can, canAll, permissions: set, loading: !data && !!user };
}
