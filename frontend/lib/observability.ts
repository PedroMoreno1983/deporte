"use client";
/**
 * Observability glue: PostHog product analytics + Sentry error tracking.
 *
 * Both providers are no-ops when their env vars are missing, so dev builds
 * don't require credentials. In production set:
 *   NEXT_PUBLIC_POSTHOG_KEY     (required for PostHog)
 *   NEXT_PUBLIC_POSTHOG_HOST    (defaults to https://us.i.posthog.com)
 *   NEXT_PUBLIC_SENTRY_DSN      (required for Sentry)
 *   NEXT_PUBLIC_SENTRY_ENV      (defaults to NODE_ENV)
 *
 * Sentry server-side init lives in sentry.server.config.ts / sentry.edge.config.ts.
 */
import { useEffect } from "react";
import posthog from "posthog-js";
import { useAuthStore } from "./store";

let inited = false;

export function initObservability() {
  if (inited || typeof window === "undefined") return;
  inited = true;

  const phKey  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (phKey) {
    posthog.init(phKey, {
      api_host: phHost,
      person_profiles: "identified_only",
      capture_pageview: false, // we capture manually in pageview hook
      disable_session_recording: false,
      loaded: () => {
        if (process.env.NODE_ENV === "development") posthog.debug();
      },
    });
  }
}

export function identifyUser(user: { id: number; email: string; full_name: string; role: string; club_id?: number | null }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.identify(String(user.id), {
    email:     user.email,
    full_name: user.full_name,
    role:      user.role,
    club_id:   user.club_id ?? null,
  });
}

export function trackEvent(event: string, props?: Record<string, any>) {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture(event, props);
}

export function resetIdentity() {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.reset();
}

/** Mount once at the root of the app. */
export function ObservabilityBootstrap() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    initObservability();
  }, []);

  useEffect(() => {
    if (user) identifyUser(user);
    else resetIdentity();
  }, [user]);

  // Pageview on route change
  useEffect(() => {
    const onRoute = () => {
      if (typeof window === "undefined") return;
      trackEvent("$pageview", {
        $current_url: window.location.pathname + window.location.search,
      });
    };
    onRoute(); // initial
    window.addEventListener("popstate", onRoute);
    return () => window.removeEventListener("popstate", onRoute);
  }, []);

  return null;
}
