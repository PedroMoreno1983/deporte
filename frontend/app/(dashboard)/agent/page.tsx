"use client";
/**
 * Agente de datos (GaaS) — chat con un agente que responde SOLO con datos
 * reales del club (vía herramientas), mostrando qué datos respaldan cada
 * respuesta. No es un chatbot: cada número viene de una tool sobre tu BD.
 */
import { useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { agentApi, type AgentToolCall } from "@/lib/api";
import { GlowCard } from "@/components/ui/GlowCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bot, Send, Loader2, User as UserIcon, Database, ChevronDown, Sparkles } from "lucide-react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  tools?: AgentToolCall[];
};

const SUGGESTIONS = [
  "¿Qué jugadores tienen mayor riesgo de lesión esta semana?",
  "Resumime el rendimiento del plantel.",
  "¿Cómo venimos en los últimos partidos?",
  "¿Hay alertas de bienestar en el plantel?",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (history: Msg[]) =>
      agentApi.chat(history.map((m) => ({ role: m.role, content: m.content }))),
    onSuccess: (data) =>
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, tools: data.tool_calls }]),
    onError: (e: any) =>
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: e?.response?.data?.detail
          ? `⚠️ ${e.response.data.detail}`
          : "⚠️ No pude responder (revisá la conexión o la configuración del agente).",
      }]),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, chat.isPending]);

  function send(text: string) {
    const t = text.trim();
    if (!t || chat.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    chat.mutate(next);
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)]">
      <PageHeader
        title="Agente de datos"
        subtitle="Preguntá en lenguaje natural — responde con tus datos reales, citando la fuente"
        icon={Bot}
        iconColor="text-[#00ff87]"
      />

      <GlowCard className="flex-1 flex flex-col mt-4 overflow-hidden p-0">
        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="p-3 rounded-2xl" style={{ background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.2)" }}>
                <Sparkles className="w-7 h-7 text-[#00ff87]" />
              </div>
              <div>
                <p className="text-white/80 font-semibold">Preguntale al agente sobre tu plantel</p>
                <p className="text-white/40 text-sm mt-1">Solo responde con datos que existen en tu base — nunca inventa.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 max-w-2xl w-full mt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-sm px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}

          {chat.isPending && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Bot className="w-4 h-4 text-[#00ff87]" />
              <Loader2 className="w-4 h-4 animate-spin" /> Consultando tus datos…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="Escribí tu pregunta… (Enter para enviar)"
              className="flex-1 resize-none px-3 py-2.5 text-sm rounded-xl outline-none focus:ring-2 focus:ring-[rgba(0,255,135,0.3)]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", maxHeight: 120 }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || chat.isPending}
              className="p-2.5 rounded-xl transition-all disabled:opacity-40 shrink-0"
              style={{ background: "var(--brand)", color: "#04140c" }}
            >
              {chat.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const [showData, setShowData] = useState(false);
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: isUser ? "rgba(255,255,255,0.06)" : "rgba(0,255,135,0.12)" }}>
        {isUser ? <UserIcon className="w-4 h-4 text-white/60" /> : <Bot className="w-4 h-4 text-[#00ff87]" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        <div className="px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
          style={{
            background: isUser ? "rgba(0,255,135,0.10)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isUser ? "rgba(0,255,135,0.2)" : "var(--border-subtle)"}`,
            color: "var(--text-primary)",
          }}>
          {msg.content}
        </div>

        {/* Data transparency: which tools/data backed this answer */}
        {!isUser && msg.tools && msg.tools.length > 0 && (
          <div className="w-full">
            <button onClick={() => setShowData((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors">
              <Database className="w-3 h-3" />
              {msg.tools.length} consulta{msg.tools.length > 1 ? "s" : ""} a tus datos
              <ChevronDown className={`w-3 h-3 transition-transform ${showData ? "rotate-180" : ""}`} />
            </button>
            {showData && (
              <div className="mt-1.5 space-y-1.5">
                {msg.tools.map((tc, i) => (
                  <div key={i} className="text-[11px] font-mono rounded-lg p-2 overflow-x-auto"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                    <span className="text-[#00ff87]">{tc.tool}</span>({JSON.stringify(tc.args)})
                    <div className="text-white/40 mt-0.5 line-clamp-3">{JSON.stringify(tc.result)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
