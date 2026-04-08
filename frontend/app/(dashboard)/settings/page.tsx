"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Settings, Plus, Tag, Users, Shield, Eye, EyeOff, Loader2, Check, Trash2 } from "lucide-react";
import { categoriesApi, api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  admin:         { label: "Administrador", color: "#ff3b30",  bg: "rgba(255,59,48,0.12)"   },
  coach:         { label: "Entrenador",    color: "#00ff87",  bg: "rgba(0,255,135,0.12)"   },
  kinesiologist: { label: "Kinesiólogo",   color: "#0ea5e9",  bg: "rgba(14,165,233,0.12)"  },
  analyst:       { label: "Analista",      color: "#a855f7",  bg: "rgba(168,85,247,0.12)"  },
};

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]";
const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" };
const labelCls = "text-xs font-semibold block mb-1.5";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] as any },
});

export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [catForm, setCatForm] = useState({ name: "", code: "", min_age: "", max_age: "" });
  const [userForm, setUserForm] = useState({ email: "", full_name: "", password: "", role: "coach" });
  const [showPwd, setShowPwd] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => categoriesApi.list() });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then(r => r.data),
    enabled: user?.role === "admin",
  });

  const createCategory = useMutation({
    mutationFn: (data: unknown) => api.post("/categories", data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCatForm({ name: "", code: "", min_age: "", max_age: "" });
      toast.success("Categoría creada");
    },
    onError: () => toast.error("Error al crear categoría"),
  });

  const createUser = useMutation({
    mutationFn: (data: unknown) => api.post("/users", data).then(r => r.data),
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
      api.patch(`/users/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: () => toast.error("Error al actualizar usuario"),
  });

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto max-w-4xl">
      {/* Header */}
      <PageHeader
        icon={Settings}
        title="Configuración"
        description="Gestión de categorías y usuarios del sistema"
        iconColor="text-gray-400"
        iconBg="bg-gray-500/10 border-gray-500/20"
        className="pl-12 lg:pl-0"
      />

      {/* My account card */}
      <motion.div {...stagger(0)}>
        <GlowCard className="p-5 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Mi cuenta</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(0,255,135,0.2), rgba(0,255,135,0.08))", border: "1px solid rgba(0,255,135,0.35)", color: "var(--neon)" }}>
              {user?.full_name?.charAt(0) ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white/90">{user?.full_name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{user?.email}</p>
            </div>
            {user?.role && (
              <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
                style={{ color: ROLE_CFG[user.role]?.color, background: ROLE_CFG[user.role]?.bg }}>
                {ROLE_CFG[user.role]?.label ?? user.role}
              </span>
            )}
          </div>
        </GlowCard>
      </motion.div>

      {/* Categories */}
      <motion.div {...stagger(1)}>
        <GlowCard className="rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(0,255,135,0.1)" }}>
              <Tag className="w-4 h-4" style={{ color: "var(--neon)" }} />
            </div>
            <h3 className="text-sm font-bold">Categorías</h3>
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              {(categories as any[]).length}
            </span>
          </div>

          {/* Existing categories */}
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {(categories as any[]).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(0,255,135,0.1)", color: "var(--neon)", border: "1px solid rgba(0,255,135,0.2)" }}>
                  {c.code}
                </span>
                <span className="text-sm font-semibold text-white/85 flex-1">{c.name}</span>
                {c.min_age && c.max_age && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.min_age}–{c.max_age} años</span>
                )}
              </div>
            ))}
          </div>

          {/* Add category form */}
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.015)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Agregar categoría</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <input placeholder="Nombre" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} style={inputStyle} />
              <input placeholder="Código (ej: U17)" value={catForm.code}
                onChange={e => setCatForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className={inputCls} style={inputStyle} />
              <input placeholder="Edad mín." type="number" value={catForm.min_age}
                onChange={e => setCatForm(f => ({ ...f, min_age: e.target.value }))}
                className={inputCls} style={inputStyle} />
              <input placeholder="Edad máx." type="number" value={catForm.max_age}
                onChange={e => setCatForm(f => ({ ...f, max_age: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <button
              onClick={() => createCategory.mutate({ ...catForm, min_age: catForm.min_age ? Number(catForm.min_age) : null, max_age: catForm.max_age ? Number(catForm.max_age) : null })}
              disabled={!catForm.name || !catForm.code || createCategory.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.25)", color: "var(--neon)" }}
            >
              {createCategory.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Agregar
            </button>
          </div>
        </GlowCard>
      </motion.div>

      {/* Users — admin only */}
      {user?.role === "admin" && (
        <>
          {/* Users list */}
          <motion.div {...stagger(2)}>
            <GlowCard className="rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(14,165,233,0.1)" }}>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold">Usuarios del sistema</h3>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  {(users as any[]).length}
                </span>
              </div>

              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {(users as any[]).map((u: any, i: number) => {
                  const roleCfg = ROLE_CFG[u.role] ?? ROLE_CFG.coach;
                  const isMe = u.id === (user as any)?.id;
                  return (
                    <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: `${roleCfg.color}15`, border: `1px solid ${roleCfg.color}30`, color: roleCfg.color }}>
                        {u.full_name?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/85 truncate">
                          {u.full_name} {isMe && <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>(tú)</span>}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                        style={{ color: roleCfg.color, background: roleCfg.bg }}>
                        {roleCfg.label}
                      </span>
                      {!isMe && (
                        <button
                          onClick={() => toggleUser.mutate({ id: u.id, is_active: !u.is_active })}
                          className="shrink-0 text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{
                            color: u.is_active ? "var(--text-muted)" : "#00ff87",
                            background: u.is_active ? "rgba(255,255,255,0.04)" : "rgba(0,255,135,0.08)",
                          }}
                          title={u.is_active ? "Desactivar" : "Activar"}
                        >
                          {u.is_active ? "Activo" : "Inactivo"}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </GlowCard>
          </motion.div>

          {/* Create user */}
          <motion.div {...stagger(3)}>
            <GlowCard className="p-5 rounded-2xl" style={{ border: "1px solid rgba(14,165,233,0.15)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(14,165,233,0.1)" }}>
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold">Crear nuevo usuario</h3>
              </div>

              {createdUser && (
                <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
                  style={{ background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.2)" }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: "var(--neon)" }} />
                  <span style={{ color: "var(--neon)" }}>
                    <strong>{createdUser.full_name}</strong> creado como {ROLE_CFG[createdUser.role]?.label}
                  </span>
                  <button onClick={() => setCreatedUser(null)} className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Nombre completo</label>
                  <input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Pedro García" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Email</label>
                  <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="pedro@club.com" className={inputCls} style={inputStyle} />
                </div>
                <div className="relative">
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Contraseña</label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={userForm.password}
                    onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className={inputCls + " pr-10"}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-8"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--text-secondary)" }}>Rol</label>
                  <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                    className={inputCls} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="coach">Entrenador</option>
                    <option value="kinesiologist">Kinesiólogo</option>
                    <option value="analyst">Analista</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => createUser.mutate(userForm)}
                  disabled={!userForm.email || !userForm.full_name || !userForm.password || createUser.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                  style={{ background: "#0ea5e9", color: "#000" }}
                >
                  {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Crear usuario
                </button>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  El usuario podrá iniciar sesión de inmediato
                </p>
              </div>
            </GlowCard>
          </motion.div>
        </>
      )}
    </div>
  );
}
