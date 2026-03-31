"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Plus, Trash2, Users, Tag } from "lucide-react";
import { categoriesApi, api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";

export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [catForm, setCatForm] = useState({ name: "", code: "", min_age: "", max_age: "" });
  const [userForm, setUserForm] = useState({ email: "", full_name: "", password: "", role: "coach" });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const createCategory = useMutation({
    mutationFn: (data: unknown) => categoriesApi.list().then(() => api.post("/categories", data).then(r => r.data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCatForm({ name: "", code: "", min_age: "", max_age: "" });
      toast.success("Categoría creada");
    },
  });

  const createUser = useMutation({
    mutationFn: (data: unknown) => api.post("/users", data).then(r => r.data),
    onSuccess: () => {
      setUserForm({ email: "", full_name: "", password: "", role: "coach" });
      toast.success("Usuario creado");
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error al crear usuario"),
  });

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gray-500/10 border border-gray-500/20">
          <Settings className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground text-sm">Gestión de categorías y usuarios</p>
        </div>
      </div>

      {/* Categories */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Categorías</h3>
        </div>
        <div className="space-y-2 mb-4">
          {categories?.map((c: { id: number; name: string; code: string; min_age?: number; max_age?: number }) => (
            <div key={c.id} className="flex items-center justify-between bg-white/3 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{c.code}</span>
                <span className="font-medium">{c.name}</span>
                {c.min_age && c.max_age && <span className="text-xs text-muted-foreground">{c.min_age}-{c.max_age} años</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-border">
          <input placeholder="Nombre" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
          <input placeholder="Código (ej: U17)" value={catForm.code} onChange={e => setCatForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
          <input placeholder="Edad mín." type="number" value={catForm.min_age} onChange={e => setCatForm(f => ({ ...f, min_age: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
          <input placeholder="Edad máx." type="number" value={catForm.max_age} onChange={e => setCatForm(f => ({ ...f, max_age: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
        </div>
        <button
          onClick={() => createCategory.mutate({ ...catForm, min_age: catForm.min_age ? Number(catForm.min_age) : null, max_age: catForm.max_age ? Number(catForm.max_age) : null })}
          disabled={!catForm.name || !catForm.code}
          className="mt-2 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar categoría
        </button>
      </motion.div>

      {/* Users */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Crear usuario</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Nombre completo</label>
            <input value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Contraseña</label>
            <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Rol</label>
            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="coach">Entrenador</option>
              <option value="kinesiologist">Kinesiólogo</option>
              <option value="analyst">Analista</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => createUser.mutate(userForm)}
          disabled={!userForm.email || !userForm.full_name || !userForm.password}
          className="mt-4 flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Crear usuario
        </button>
      </motion.div>

      {/* Info panel */}
      <div className="glass rounded-xl p-4 text-sm text-muted-foreground border border-white/5">
        <p className="font-medium text-foreground mb-1">Tu cuenta</p>
        <p>{user?.full_name} · {user?.email}</p>
        <p className="capitalize mt-0.5">Rol: {user?.role}</p>
      </div>
    </div>
  );
}
