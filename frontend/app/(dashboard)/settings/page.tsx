"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, Eye, EyeOff, Loader2, Check, RefreshCw } from "lucide-react";
import { categoriesApi, clubsApi, api, agentApi } from "@/lib/api";
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
  const [clubName, setClubName] = useState("");

  // AI config state
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  const { data: club } = useQuery({
    queryKey: ["my-club"],
    queryFn: () => clubsApi.me(),
    enabled: !!user?.club_id,
  });

  useEffect(() => {
    if (club) {
      setClubName(club.name || "");
      setAiProvider(club.ai_provider || "offline");
      setAiApiKey(club.has_ai_api_key ? "••••••••••••••••" : "");
      setAiModel(club.ai_model || "");
    }
  }, [club]);

  const updateClub = useMutation({
    mutationFn: (data: { name?: string; ai_provider?: string | null; ai_api_key?: string | null; ai_model?: string | null }) => 
      clubsApi.update(user!.club_id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-club"] });
      toast.success("Configuración guardada correctamente");
    },
    onError: () => toast.error("Error al guardar configuración"),
  });


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

      <Card kicker="Institución" title="Datos del Club">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
          <div>
            <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Nombre del Club / Equipo</Note>
            <input 
              value={clubName} 
              onChange={(e) => setClubName(e.target.value)} 
              placeholder="Ej. Petroleros" 
              className="input" 
              style={{ width: "100%" }}
              disabled={user?.role !== "admin" || updateClub.isPending}
            />
          </div>
          {user?.role === "admin" && (
            <div className="flex items-end">
              <button
                onClick={() => updateClub.mutate({ name: clubName })}
                disabled={!clubName || clubName === club?.name || updateClub.isPending}
                className="btn-primary text-sm disabled:opacity-40"
                style={{ height: 42 }}
              >
                {updateClub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar Cambios
              </button>
            </div>
          )}
        </div>
      </Card>

      <Card kicker="Inteligencia Artificial" title="Configuración de IA">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="filter-bar" style={{ gap: 8 }}>
            <Note style={{ fontSize: 15, opacity: 0.9 }}>
              Estado del Asistente:
            </Note>
            <span
              className="chip is-on"
              style={{
                background: aiProvider !== "offline" ? "var(--pine)" : "var(--ochre)",
                color: "#fff",
                border: "none",
              }}
            >
              {aiProvider === "offline"
                ? "Modo simulación sin conexión"
                : `Activo (${aiProvider.toUpperCase()})`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Proveedor de IA</Note>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiProvider(val);
                  // set default models automatically
                  if (val === "groq") setAiModel("llama-3.3-70b-versatile");
                  else if (val === "gemini") setAiModel("gemini-1.5-flash");
                  else if (val === "claude") setAiModel("claude-3-5-sonnet-20241022");
                  else setAiModel("");
                  setAiApiKey("");
                }}
                disabled={user?.role !== "admin" || updateClub.isPending}
                className="input"
                style={{ width: "100%" }}
              >
                <option value="offline">Simulación sin conexión (Heurístico)</option>
                <option value="groq">Groq (Llama 3)</option>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Anthropic Claude</option>
              </select>
            </div>

            {aiProvider !== "offline" && (
              <>
                <div style={{ position: "relative" }}>
                  <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>API Key del Proveedor</Note>
                  <input
                    type={showAiKey ? "text" : "password"}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={club?.has_ai_api_key ? "••••••••••••••••" : "Ingresá tu API Key"}
                    disabled={user?.role !== "admin" || updateClub.isPending}
                    className="input"
                    style={{ width: "100%", paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    style={{ position: "absolute", right: 12, top: 32, color: "var(--ink-faint)" }}
                  >
                    {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div>
                  <Note style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Modelo de IA</Note>
                  <input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="ej. gemini-1.5-flash"
                    disabled={user?.role !== "admin" || updateClub.isPending}
                    className="input"
                    style={{ width: "100%" }}
                  />
                </div>
              </>
            )}
          </div>

          {user?.role === "admin" && (
            <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--rule)" }}>
              {aiProvider !== "offline" && (
                <button
                  type="button"
                  disabled={testingKey || !aiApiKey}
                  onClick={async () => {
                    setTestingKey(true);
                    try {
                      // If placeholder is unchanged, use existing key. We'll send what is in inputs
                      const keyToSend = aiApiKey === "••••••••••••••••" ? "" : aiApiKey;
                      if (!keyToSend && aiApiKey !== "••••••••••••••••") {
                        toast.error("Por favor, ingresá una API Key primero");
                        setTestingKey(false);
                        return;
                      }
                      
                      const res = await agentApi.testApiKey({
                        provider: aiProvider,
                        api_key: keyToSend || (club?.has_ai_api_key ? "EXISTING" : ""),
                        model: aiModel,
                      });
                      if (res.ok) {
                        toast.success(`Conexión exitosa! Ping reply: "${res.reply}"`);
                      } else {
                        toast.error("Error al probar la clave");
                      }
                    } catch (err: any) {
                      toast.error(err.response?.data?.detail || "Error validando clave");
                    } finally {
                      setTestingKey(false);
                    }
                  }}
                  className="chip"
                  style={{ height: 38, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Probar Conexión
                </button>
              )}

              <button
                onClick={() => {
                  const keyToSend = aiApiKey === "••••••••••••••••" ? null : aiApiKey;
                  updateClub.mutate({
                    ai_provider: aiProvider === "offline" ? null : aiProvider,
                    ai_api_key: aiProvider === "offline" ? null : keyToSend,
                    ai_model: aiProvider === "offline" ? null : aiModel,
                  });
                }}
                disabled={updateClub.isPending}
                className="btn-primary text-sm"
                style={{ height: 38, marginLeft: "auto" }}
              >
                {updateClub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar Configuración de IA
              </button>

              {club?.ai_provider && (
                <button
                  onClick={() => {
                    if (confirm("¿Estás seguro de eliminar la configuración de IA? El asistente volverá al modo sin conexión.")) {
                      updateClub.mutate({
                        ai_provider: null,
                        ai_api_key: null,
                        ai_model: null,
                      });
                    }
                  }}
                  disabled={updateClub.isPending}
                  className="chip"
                  style={{ height: 38, padding: "0 14px", color: "var(--terracotta)" }}
                >
                  Eliminar IA
                </button>
              )}
            </div>
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
