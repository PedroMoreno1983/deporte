"use client";
/**
 * Agente de datos (GaaS) — chat con un agente que responde SOLO con datos
 * reales del club (vía herramientas), mostrando qué datos respaldan cada
 * respuesta. No es un chatbot: cada número viene de una tool sobre tu BD.
 */
import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentApi, type AgentToolCall } from "@/lib/api";
import { Loader2, Database, ChevronDown, RefreshCw, AlertTriangle, FileDown, FileText } from "lucide-react";
import { PageTitle, Card } from "@/components/lupi/viz";
import { Note } from "@/components/lupi/primitives";

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
    <div className="screen">
      <PageTitle title="Asistente" subtitle="preguntas en voz alta, respuestas con los datos reales del plantel" />

      <BriefingCard />

      <Card kicker="Cada número viene de una consulta a tu base" title="Asistente táctico">
        <div className="chat">
          <div className="chat-log">
            {messages.length === 0 && (
              <Note style={{ fontSize: 16.5, opacity: 0.8, display: "block", padding: "8px 2px" }}>
                Preguntale al agente sobre tu plantel. Solo responde con datos que existen en tu base — nunca inventa.
              </Note>
            )}

            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

            {chat.isPending && (
              <div className="bubble bot" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="bubble-mark" />
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--terracotta)" }} />
                <span className="bubble-text">consultando tus datos…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 0 && (
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className="chat-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="Escribí tu pregunta… (Enter para enviar)"
              className="chat-field"
              style={{ resize: "none", maxHeight: 120 }}
            />
            <button className="chat-send" onClick={() => send(input)} disabled={!input.trim() || chat.isPending}>
              {chat.isPending ? "…" : "Enviar"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BriefingCard() {
  const qc = useQueryClient();
  const { data: briefing, isLoading } = useQuery({
    queryKey: ["agent-briefing"],
    queryFn: () => agentApi.getBriefing(),
  });
  const run = useMutation({
    mutationFn: () => agentApi.runBriefing(),
    onSuccess: (b) => qc.setQueryData(["agent-briefing"], b),
  });
  const prios = (briefing?.data?.prioridades as string[] | undefined) ?? [];

  return (
    <Card
      kicker="Lo que el cuerpo técnico debería mirar hoy"
      title="Briefing del plantel"
      note={briefing?.briefing_date ?? undefined}
    >
      <div className="filter-bar" style={{ marginBottom: 10 }}>
        {briefing?.generated_by && (
          <span className="chip is-on">{briefing.generated_by === "llm" ? "IA" : "auto"}</span>
        )}
        <button onClick={() => run.mutate()} disabled={run.isPending} className="chip" style={{ marginLeft: "auto" }}>
          {run.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {briefing ? "Actualizar" : "Generar"}
        </button>
      </div>

      {isLoading ? (
        <Note style={{ fontSize: 16, opacity: 0.7 }}>cargando…</Note>
      ) : !briefing ? (
        <Note style={{ fontSize: 16, opacity: 0.8 }}>
          Todavía no hay briefing de hoy. El agente lo genera cada mañana; o tocá <b>Generar</b>.
        </Note>
      ) : (
        <>
          <p style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 18, color: "var(--ink)" }}>{briefing.headline}</p>
          {briefing.summary && (
            <p style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink-soft)", marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {briefing.summary}
            </p>
          )}
          {prios.length > 0 && (
            <ul style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {prios.map((p, i) => (
                <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontFamily: "var(--serif)", fontSize: 15, color: "var(--ink-soft)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--ochre)" }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const [showData, setShowData] = useState(false);
  const isUser = msg.role === "user";

  const report = !isUser
    ? msg.tools?.map((t) => t.result as { report_id?: number } | null).find((r) => r && r.report_id)
    : undefined;
  const rid = report?.report_id;

  return (
    <div className={"bubble " + (isUser ? "user" : "bot")}>
      {!isUser && <span className="bubble-mark" />}
      <span className="bubble-text">{msg.content}</span>

      {rid && (
        <div className="filter-bar" style={{ marginTop: 10 }}>
          <button onClick={() => agentApi.openReportPdf(rid)} className="chip">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => agentApi.downloadReportDocx(rid)} className="chip">
            <FileText className="w-3.5 h-3.5" /> Word
          </button>
        </div>
      )}

      {!isUser && msg.tools && msg.tools.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowData((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-faint)", cursor: "pointer" }}>
            <Database className="w-3 h-3" />
            {msg.tools.length} consulta{msg.tools.length > 1 ? "s" : ""} a tus datos
            <ChevronDown className={"w-3 h-3 transition-transform" + (showData ? " rotate-180" : "")} />
          </button>
          {showData && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              {msg.tools.map((tc, i) => (
                <div key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, borderRadius: 8, padding: 8, overflowX: "auto",
                  background: "rgba(44,38,32,0.06)", border: "1px solid var(--rule)", color: "var(--ink-soft)" }}>
                  <span style={{ color: "var(--terracotta)" }}>{tc.tool}</span>({JSON.stringify(tc.args)})
                  <div style={{ color: "var(--ink-faint)", marginTop: 2 }}>{JSON.stringify(tc.result)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
