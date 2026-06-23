"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Bot, X, Send, Sparkles, Loader2 } from "lucide-react";
import { aiTacticalApi } from "@/lib/api";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "¿Qué jugadores debo rotar este fin de semana?",
  "¿Cómo contrarresto un 4-2-3-1 rival?",
  "Recomienda ejercicios para mejorar transiciones defensivas",
  "¿Cuáles jugadores muestran fatiga acumulada?",
];

/**
 * Floating tactical AI assistant.
 * Click the orb (bottom-right) to open a conversational panel.
 */
export function TacticalAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (history: Message[]) => aiTacticalApi.chat(history),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail ?? "Error consultando al asistente";
      toast.error(detail);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    ask.mutate(next);
  }

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 rounded-full flex items-center justify-center transition-all"
        style={{
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, var(--terracotta), #0ea5e9)",
          boxShadow: open
            ? "0 0 32px rgba(37,99,235,0.45), 0 0 0 3px rgba(37,99,235,0.15)"
            : "0 0 20px rgba(37,99,235,0.30), 0 8px 24px rgba(0,0,0,0.15)",
        }}
        aria-label="Abrir asistente táctico"
        title="Asistente táctico IA"
      >
        {open ? (
          <X className="w-5 h-5 text-white" strokeWidth={2.8} />
        ) : (
          <Bot className="w-5 h-5 text-white" strokeWidth={2.5} />
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-40 glass rounded-2xl flex flex-col"
            style={{
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              height: 560,
              maxHeight: "calc(100vh - 140px)",
              border: "1px solid var(--rule)",
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px var(--rule), 0 0 32px rgba(0,0,0,0.04)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--rule)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, var(--paper-inset), var(--paper))",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: "var(--terracotta)" }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: "var(--ink)" }}>Asistente táctico</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    Powered by Groq · Llama 3.3
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
                className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors disabled:opacity-30"
                style={{ color: "var(--ink-soft)" }}
              >
                Limpiar
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center pt-4">
                  <div
                    className="inline-flex p-3 rounded-2xl mb-3"
                    style={{
                      background: "var(--paper-inset)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    <Bot className="w-6 h-6" style={{ color: "var(--terracotta)" }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Hola, soy tu asistente táctico</p>
                  <p
                    className="text-xs mt-1 mb-4 max-w-xs mx-auto"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    Tengo el contexto del plantel (wellness, lesiones, últimos partidos). Pregúntame lo que necesites.
                  </p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg transition-all"
                        style={{
                          background: "var(--paper)",
                          border: "1px solid var(--rule)",
                          color: "var(--ink-soft)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--paper-inset)";
                          e.currentTarget.style.borderColor = "var(--ink-faint)";
                          e.currentTarget.style.color = "var(--ink)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--paper)";
                          e.currentTarget.style.borderColor = "var(--rule)";
                          e.currentTarget.style.color = "var(--ink-soft)";
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className="rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                      style={
                        m.role === "user"
                          ? {
                              maxWidth: "85%",
                              background: "var(--terracotta)",
                              border: "1px solid var(--terracotta)",
                              color: "#ffffff",
                            }
                          : {
                              maxWidth: "92%",
                              background: "var(--paper-inset)",
                              border: "1px solid var(--rule)",
                              color: "var(--ink)",
                            }
                      }
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))
              )}
              {ask.isPending && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--terracotta)" }} />
                  Analizando contexto y respondiendo...
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 px-3 py-3"
              style={{ borderTop: "1px solid var(--rule)" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo táctico..."
                className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--rule)",
                  color: "var(--ink)",
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || ask.isPending}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{
                  background: "var(--terracotta)",
                  color: "#ffffff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
                aria-label="Enviar"
              >
                {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
