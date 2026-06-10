"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { categoriesApi, api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import { resetOnboarding } from "@/components/onboarding/OnboardingTour";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

const ROLE_CFG: Record<string, { label: string; color: string }> = {
  admin:         { label: "Administrador", color: "var(--terracotta)" },
  coach:         { label: "Entrenador",    color: "var(--pine)" },
  kinesiologist: { label: "Kinesiólogo",   color: "var(--slate)" },
  analyst:       { label: "Analista",      color: "var(--plum)" },
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [catForm, setCatForm] = useState({ name: "", code: "", min_age: "", max_age: "" });
  const [userForm, setUserForm] = useState({ email: "", full_name: "", password: "", role: "coach" });
  const [showPwd, setShowPwd] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
    enabled: user?.role === "admin",
  });

  const createCategory = useMutation({
    mutationFn: (data: unknown) => api.post("/categories", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCatForm({ name: "", code: "", min_age: "", max_age: "" });
      toast.success("Categoría creada");
    },
    onError: () => toast.error("Error al crear categoría"),
  });

  const createUser = useMutation({
    mutationFn: (data: unknown) => api.post("/users", data).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setCreatedUser(data);
      setUserForm({ email: "", full_name: "", password: "", role: "coach" });
      toast.success(`Usuario ${data.full_name} creado`);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error al crear usuario"),
  });

  const toggleUser = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/users/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: () => toast.error("Error al actualizar usuario"),
  });

  return (
    <div className="screen" style={{ maxWidth: 920 }}>
      <PageTitle title="Configuración" subtitle="categorías, usuarios y seguridad del cuaderno" />

      <Card kicker="¿Recién te integras al cuerpo técnico?" title="Tour de bienvenida">
        <div className="filter-bar">
          <Note style={{ fontSize: 16, opacity: 0.85 }}>
            Revisa los puntos clave de la plataforma cuando quieras.
          </Note>
          <button onClick={resetOnboarding} className="chip is-on" style={{ marginLeft: "auto" }}>Reiniciar tour</button>
        </div>
      </Card>

      <Card kicker="Sesión actual" title="Mi cuenta">
        <div className="filter-bar">
          <div className="user-avatar">{user?.full_name?.charAt(0) ?? "U"}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>{user?.full_name}</div>
            <Note style={{ fontSize: 14 }}>{user?.email}</Note>
          </div>
          {user?.role && (
            <span className="chip" style={{ marginLeft: "auto", color: ROLE_CFG[user.role]?.color }}>
              <span className="chip-dot" style={{ background: ROLE_CFG[user.role]?.color }} />
              {ROLE_CFG[user.role]?.label ?? user.role}
            </span>
          )}
        </div>
      </Card>

      <TwoFactorCard />

      <Card kicker="Divisiones del club" title="Categorías" note={`${(categories as any[]).length} registradas`}>
        <div className="inj-list" style={{ marginBottom: 14 }}>
          {(categories as any[]).map((c: any) => (
            <div className="inj-row" key={c.id}>
              <span className="chip is-on" style={{ padding: "2px 10px", fontSize: 13 }}>{c.code}</span>
              <span className="inj-player" style={{ cursor: "default" }}>{c.name}</span>
              {c.min_age && c.max_age && <span className="inj-region" style={{ marginLeft: "auto" }}>{c.min_age}–{c.max_age} años</span>}
            </div>
          ))}
        </div>

        <Note style={{ fontSize: 14, display: "block", marginBottom: 8 }}>Agregar categoría</Note>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: 10 }}>
          <input placeholder="Nombre" value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} className="input" />
          <input placeholder="Código (ej: U17)" value={catForm.code} onChange={(e) => setCatForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="input" />
          <input placeholder="Edad mín." type="number" value={catForm.min_age} onChange={(e) => setCatForm((f) => ({ ...f, min_age: e.target.value }))} className="input" />
          <input placeholder="Edad máx." type="number" value={catForm.max_age} onChange={(e) => setCatForm((f) => ({ ...f, max_age: e.target.value }))} className="input" />
        </div>
        <button
          onClick={() => createCategory.mutate({ ...catForm, min_age: catForm.min_age ? Number(catForm.min_age) : null, max_age: catForm.max_age ? Number(catForm.max_age) : null })}
          disabled={!catForm.name || !catForm.code || createCategory.isPending}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {createCategory.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
        </button>
      </Card>

      {user?.role === "admin" && (
        <>
          <Card kicker="Acceso al cuaderno" title="Usuarios del sistema" note={`${(users as any[]).length} usuarios`}>
            <div className="inj-list">
              {(users as any[]).map((u: any) => {
                const roleCfg = ROLE_CFG[u.role] ?? ROLE_CFG.coach;
                const isMe = u.id === (user as any)?.id;
                return (
                  <div className="inj-row" key={u.id}>
                    <span className="inj-region-dot" style={{ background: roleCfg.color }} />
                    <span className="inj-player" style={{ cursor: "default" }}>
                      {u.full_name} {isMe && <Note style={{ fontSize: 13 }}>(tú)</Note>}
                    </span>
                    <span className="inj-region">{u.email}</span>
                    <span className="inj-month" style={{ color: roleCfg.color }}>{roleCfg.label}</span>
                    {!isMe && (
                      <button
                        onClick={() => toggleUser.mutate({ id: u.id, is_active: !u.is_active })}
                        className="chip"
                        style={{ color: u.is_active ? "var(--ink-soft)" : "var(--pine)" }}
                        title={u.is_active ? "Desactivar" : "Activar"}
                      >
                        {u.is_active ? "Activo" : "Inactivo"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card kicker="Alta de cuenta" title="Crear nuevo usuario">
            {createdUser && (
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <Check className="w-4 h-4" style={{ color: "var(--pine)" }} />
                <Note style={{ fontSize: 15, color: "var(--pine)" }}>
                  <b>{createdUser.full_name}</b> creado como {ROLE_CFG[createdUser.role]?.label}
                </Note>
                <button onClick={() => setCreatedUser(null)} className="theme-toggle" style={{ marginLeft: "auto" }}>✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Nombre completo</Note>
                <input value={userForm.full_name} onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Pedro García" className="input" style={{ width: "100%" }} />
              </div>
              <div>
                <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Email</Note>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} placeholder="pedro@club.com" className="input" style={{ width: "100%" }} />
              </div>
              <div style={{ position: "relative" }}>
                <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Contraseña</Note>
                <input
                  type={showPwd ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input"
                  style={{ width: "100%", paddingRight: 38 }}
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 12, top: 32, color: "var(--ink-faint)" }}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div>
                <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Rol</Note>
                <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))} className="input" style={{ width: "100%" }}>
                  <option value="coach">Entrenador</option>
                  <option value="kinesiologist">Kinesiólogo</option>
                  <option value="analyst">Analista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="filter-bar" style={{ marginTop: 14 }}>
              <button
                onClick={() => createUser.mutate(userForm)}
                disabled={!userForm.email || !userForm.full_name || !userForm.password || createUser.isPending}
                className="btn-primary text-sm disabled:opacity-40"
              >
                {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear usuario
              </button>
              <Note style={{ fontSize: 14 }}>el usuario podrá iniciar sesión de inmediato</Note>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
