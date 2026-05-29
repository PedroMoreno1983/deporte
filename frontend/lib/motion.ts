"use client";
/**
 * Motion helpers for framer-motion that respect prefers-reduced-motion.
 *
 * Usage:
 *   const transition = useReducedTransition({ duration: 0.4 });
 *   <motion.div animate={{ opacity: 1 }} transition={transition} />
 *
 * For 3D tilts and exotic effects: gate with `useShouldAnimate()`.
 */
import { useEffect, useState } from "react";
import type { Transition } from "framer-motion";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

export function useShouldAnimate(): boolean {
  return !usePrefersReducedMotion();
}

/** Wrap a transition so it collapses to instant when reduced-motion is on. */
export function useReducedTransition(base: Transition): Transition {
  const reduced = usePrefersReducedMotion();
  if (reduced) return { duration: 0 };
  return base;
}
