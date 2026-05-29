"use client";
/**
 * Realtime WebSocket client for Deporte FC.
 *
 * - Connects to `${WS_URL}/ws?token=...&topics=...`
 * - Reconnects automatically with exponential backoff capped at 30s
 * - Distributes events to per-topic subscribers
 * - Singleton: one socket per browser tab regardless of subscribers
 *
 * Usage:
 *   useRealtime("injuries", (event) => qc.invalidateQueries(["active-injuries"]));
 *
 * Server payload contract (see backend `manager.RealtimeEvent`):
 *   { topic: string; type: string; payload: object; ts: string }
 */
import { useEffect, useRef } from "react";
import { useAuthStore } from "./store";

export interface RealtimeEvent<T = any> {
  topic:   string;
  type:    string;
  payload: T;
  ts:      string;
}

type Handler = (event: RealtimeEvent) => void;

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  // derive from API URL: http(s)://host/api/v1  →  ws(s)://host
  ((): string => {
    if (typeof window === "undefined") return "";
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    try {
      const u = new URL(api);
      const proto = u.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${u.host}`;
    } catch {
      return "";
    }
  })();

const ALL_TOPICS = ["notifications", "wellness", "team", "injuries", "cv"] as const;
type Topic = (typeof ALL_TOPICS)[number];

class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private currentToken: string | null = null;
  private intentionallyClosed = false;

  on(topic: string, handler: Handler) {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic)!.add(handler);
    return () => {
      this.handlers.get(topic)?.delete(handler);
    };
  }

  ensureConnected(token: string) {
    if (this.ws && this.ws.readyState <= 1 && this.currentToken === token) return;
    if (this.ws) {
      this.intentionallyClosed = true;
      try { this.ws.close(); } catch {}
    }
    this.currentToken = token;
    this.intentionallyClosed = false;
    this.connect();
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.pingTimer)  { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.currentToken = null;
  }

  private connect() {
    if (!WS_URL || !this.currentToken) return;
    // Normalise: tolerate WS_URL with or without trailing /ws and trailing slash
    const base = WS_URL.replace(/\/+$/, "").replace(/\/ws$/, "");
    const url = `${base}/ws?token=${encodeURIComponent(this.currentToken)}&topics=${ALL_TOPICS.join(",")}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.retry = 0;
      // Heartbeat every 25s
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
        }
      }, 25_000);
    });

    ws.addEventListener("message", (msg) => {
      let event: RealtimeEvent | null = null;
      try { event = JSON.parse(msg.data); } catch { return; }
      if (!event || !event.topic) return;
      // Ignore pong / system frames for subscribers
      if (event.topic === "system") return;
      this.handlers.get(event.topic)?.forEach((h) => {
        try { h(event!); } catch (e) { console.error("[ws handler]", e); }
      });
    });

    const close = () => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      this.ws = null;
      if (!this.intentionallyClosed) this.scheduleReconnect();
    };
    ws.addEventListener("close", close);
    ws.addEventListener("error", () => {
      try { ws.close(); } catch {}
    });
  }

  private scheduleReconnect() {
    if (this.intentionallyClosed) return;
    if (this.retryTimer) return;
    const delay = Math.min(30_000, 500 * Math.pow(2, this.retry));
    this.retry++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }
}

const realtime = new RealtimeClient();

// ── React hook ───────────────────────────────────────────────────────
export function useRealtime(topic: Topic, handler: Handler) {
  const token = useAuthStore((s) => s.accessToken);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!token) return;
    realtime.ensureConnected(token);
    const off = realtime.on(topic, (e) => handlerRef.current(e));
    return off;
  }, [token, topic]);
}

/** Tear down the socket on logout */
export function disconnectRealtime() {
  realtime.disconnect();
}
