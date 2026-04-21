// ── Design system animation constants ───────────────────────────────────────

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT   = [0.4, 0, 0.2, 1] as const;
export const SPRING_SMOOTH = { type: "spring", stiffness: 350, damping: 28 } as const;
export const SPRING_TIGHT  = { type: "spring", stiffness: 400, damping: 35 } as const;

/** Standard page-entry stagger for a list item at index `i` */
export function stagger(i: number, opts?: { baseDelay?: number; step?: number; duration?: number }) {
  const { baseDelay = 0, step = 0.07, duration = 0.45 } = opts ?? {};
  return {
    initial:    { opacity: 0, y: 18 },
    animate:    { opacity: 1, y: 0  },
    transition: { delay: baseDelay + i * step, duration, ease: EASE_OUT_EXPO },
  };
}

/** Fade-in only (no translate) */
export function fadeIn(delay = 0) {
  return {
    initial:    { opacity: 0 },
    animate:    { opacity: 1 },
    transition: { delay, duration: 0.35, ease: EASE_IN_OUT },
  };
}

/** Slide up from bottom */
export function slideUp(delay = 0) {
  return {
    initial:    { opacity: 0, y: 12 },
    animate:    { opacity: 1, y: 0  },
    transition: { delay, duration: 0.4, ease: EASE_OUT_EXPO },
  };
}
