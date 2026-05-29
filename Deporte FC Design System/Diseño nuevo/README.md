# Deporte FC — Design System

## Overview

**Deporte FC** is a full-stack sports management platform for professional football (soccer) clubs. It enables coaches, kinesiologists, analysts and administrators to manage players, track injuries, plan training sessions, analyze performance, and monitor player wellness — all in real time.

The product is fully bilingual-ready but shipped in **Spanish (Latin American)** throughout the UI.

---

## Products

| Product | Stack | Path |
|---|---|---|
| **Web Dashboard** | Next.js 14, Tailwind CSS, Framer Motion | `Deporte/frontend/` |
| **Mobile App** | React Native (Expo), TanStack Query | `Deporte/mobile/` |
| **Backend API** | FastAPI, SQLAlchemy, Python, ML models | `Deporte/backend/` |

### Web Dashboard modules
- `Dashboard` — KPI overview, availability rate, injury alerts
- `Jugadores` — Player roster with 3D tilt cards, status badges, position coloring
- `Lesiones` — Injury tracking and recovery timelines
- `Partidos` — Match management
- `Entrenamiento` — Training session planning
- `Pizarra` — Tactical whiteboard
- `Calendario` — Calendar view
- `Wellness` — Player wellness metrics
- `Analytics` — Charts and statistics
- `Predicciones` — ML-based injury risk predictions

---

## Sources

- **Codebase (local)**: `Deporte/` — full monorepo with frontend, mobile, and backend
- **GitHub**: `PedroMoreno1983/deporte` (same repo, for reference)
- No Figma link was provided.

---

## CONTENT FUNDAMENTALS

**Language**: Spanish (Latin American). All UI labels, navigation items, status messages, and error text are in Spanish. Examples:
- Nav: `Dashboard`, `Jugadores`, `Lesiones`, `Partidos`, `Entrenamiento`, `Pizarra`, `Calendario`, `Wellness`, `Analytics`, `Predicciones`, `Configuración`
- Status labels: `Disponible`, `Lesionado`, `Recuperando`, `Suspendido`, `Inactivo`
- Risk levels: `Bajo`, `Moderado`, `Alto`, `Crítico`
- Roles: `Administrador`, `Entrenador`, `Kinesiólogo`, `Analista`
- Position labels: `Portero`, `Def. Central`, `Lat. Izq.`, `Lat. Der.`, `MC Def.`, `MC`, `MC Of.`, `Ext. Izq.`, `Ext. Der.`, `Delantero`

**Tone**: Professional and data-driven. Concise labels, no fluff. Very terse — single words or short phrases for nav and KPIs. No emoji in UI text.

**Casing**: Title case for page headings; sentence case for descriptions. ALL CAPS used for category labels, section headers (e.g. `GENERAL`, `ANALYTICS`, `SISTEMA`), and short badge codes (`POR`, `DEF`, `MED`, `DEL`).

**Numbers**: Displayed in JetBrains Mono with tabular-nums. Stat values are large and prominent (24–48px). Percentages, risk scores (0–100), and counters are styled as "display numbers."

**I vs You**: Not applicable — the platform is a tool, not conversational.

---

## VISUAL FOUNDATIONS

### Color System
The palette is a **dark cyber/HUD aesthetic**:
- **Primary accent**: Neon green `#00ff87` — used for active states, primary data, positive metrics, interactive highlights
- **Secondary accent**: Sky blue `#0ea5e9` — defenders, secondary data, info states
- **Danger**: `#ff3b30` — critical risk, injured status, attackers (position color)
- **Warning**: `#f59e0b` — medium risk, suspended, goalkeepers (position color)
- **Purple**: `#a855f7` — used sparingly in ambient background glow and ML/AI features

### Surface Layers (dark-only, no light mode)
```
--surface-base: #020817  (true background)
--surface-1:    #080f20  (sidebar)
--surface-2:    #0d1528  (card base)
--surface-3:    #162032  (elevated card)
--surface-4:    #1e2d40  (highest layer, inputs)
```

### Typography
- **Sans**: Inter (weights 300–900) — all body, UI, and heading text
- **Mono**: JetBrains Mono (weights 400–700) — all numbers, stat displays, jersey numbers, codes
- Headings use `letter-spacing: -0.025em` (tight)
- Display numbers use `letter-spacing: -0.04em` with `font-variant-numeric: tabular-nums`
- Section labels use `tracking-[0.18em]` uppercase tiny caps
- Google Fonts CDN: `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700`

### Backgrounds & Textures
- **Base**: Deep navy `#020817`
- **Ambient glow**: Multi-layered `radial-gradient` ellipses in neon green (10% opacity), sky blue (4.5%), and purple (3%) — always subtle, never overwhelming
- **Grid overlay**: `1px` lines at 48px intervals, `rgba(255,255,255,0.018)` — very faint tech grid
- **Gradient text**: `linear-gradient(135deg, #00ff87, #0ea5e9)` for hero values
- No images used as backgrounds. No textures or patterns beyond the grid.

### Cards
- Background: `rgba(8,15,32,0.75)` — semi-transparent dark
- Border: `1px solid rgba(255,255,255,0.10)` — subtle white border
- Border radius: `0.75rem` (12px) standard, `1rem` (16px) for player cards
- Box shadow: `0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04)`
- **Hover (GlowCard)**: Mouse-tracking radial gradient spotlight in neon green; border brightens to `rgba(0,255,135,0.28)`; card lifts `translateY(-2px)`
- **Player cards**: 3D tilt effect on hover using Framer Motion `rotateX/Y` spring physics; each card has a large watermark jersey number in the background

### Borders
```
--border-subtle: rgba(255,255,255,0.08)
--border-medium: rgba(255,255,255,0.14)
--border-strong: rgba(255,255,255,0.24)
```
Position-colored cards have a 2px top edge accent line with glow shadow matching the position color.

### Shadows / Glow System
All interactive highlights use **colored glow shadows**, not elevation shadows:
- `glow-green`: `0 0 20px rgba(0,255,135,0.25), 0 0 60px rgba(0,255,135,0.08)`
- `glow-blue`: `0 0 20px rgba(14,165,233,0.25)`
- `glow-red`: `0 0 20px rgba(255,59,48,0.35)`
- `glow-amber`: `0 0 20px rgba(245,158,11,0.25)`
- Active nav items: `0 0 24px rgba(0,255,135,0.55), 0 0 60px rgba(0,255,135,0.18)`

### Animations & Easing
- **Primary easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — fast-in, slow-out spring-like
- **Fade in**: 0.4s ease-in-out
- **Slide up**: 0.35s with primary easing
- **Stagger**: Player cards stagger by `index * 0.04s`
- **Glow pulse**: 2.5s ease-in-out infinite (opacity 0.5 → 1 → 0.5)
- **Status dot ping**: 2s `cubic-bezier(0,0,0.2,1)` infinite (scale 1 → 2.2 with fade)
- **Scan line**: Linear sweep top-to-bottom, 4–5s, neon green gradient line
- **Float**: 6s ease-in-out infinite (±10px Y)
- **Risk gauge arc**: 1.3s `cubic-bezier(0.34,1.56,0.64,1)` (overshoot spring)
- **Framer Motion**: Used everywhere for presence animations, nav transitions, sidebar collapse
- No heavy page transitions. Entrance animations are subtle.

### Interactive States
- **Hover**: `opacity` increase + glow border + slight `translateY(-2px)` lift
- **Active nav**: Full neon green pill background (`#00ff87`), black text, large glow shadow
- **Inactive nav**: `rgba(255,255,255,0.40)` text → `rgba(255,255,255,0.80)` on hover
- **Buttons**: Not explicitly coded but follow neon green primary + dark fill secondary pattern
- **Logout icon**: On hover transitions from dim white to danger red `#ff3b30`
- **Press states**: Framer Motion `whileTap={{ scale: 0.92 }}` on icon buttons

### Corner Radii
- Default: `12px` (`rounded-xl`)
- Large cards: `16px` (`rounded-2xl`)
- Avatars/icons: `12px` (`rounded-xl`)
- Small badges: `999px` (pill, `rounded-full`)
- Collapse button: `50%` (circle)

### Glass Effect
```css
background: rgba(8,15,32,0.80);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255,255,255,0.10);
```
Used for overlays, mobile drawer backdrop, tooltips.

### Scrollbars
Custom thin (4px) scrollbars with neon green thumb `rgba(0,255,135,0.20)` → hover `rgba(0,255,135,0.45)`.

### Color Vibe of Imagery
No imagery is used. The UI is purely data-driven with charts, badges, and stat displays. No photography.

---

## ICONOGRAPHY

**Icon system**: Lucide React (`lucide-react`) — used throughout the web dashboard. Consistent stroke-weight icons, size `18px` for nav, `20px` for page headers, `16px` for inline.

Icons used:
- `LayoutDashboard`, `Users`, `AlertTriangle`, `Trophy`, `Dumbbell`, `Brain`, `Settings`
- `BarChart3`, `Shield`, `Map`, `HeartPulse`, `CalendarDays`
- `ChevronLeft`, `ChevronRight`, `LogOut`, `Menu`, `X`
- `Bell` (notifications)

**Mobile app**: Ionicons via `@expo/vector-icons` (e.g. `people-outline`, `checkmark-circle-outline`, `medkit-outline`, `stats-chart-outline`)

**Logo**: No separate logo file — logo is text-based: `DEPORTE` (white, font-black) + `FC` (neon green, font-black), with a Shield icon in a neon-bordered rounded square as the logomark.

No SVG illustration assets found in the codebase. No custom icon font. No emoji used.

---

## File Index

```
README.md                    ← This file
SKILL.md                     ← Agent skill descriptor
colors_and_type.css          ← Full CSS variables and type system
assets/                      ← Logos and brand assets
preview/                     ← Design system card previews
  colors-brand.html
  colors-surfaces.html
  colors-semantic.html
  type-scale.html
  type-specimens.html
  spacing-radii.html
  spacing-shadows.html
  animations.html
  components-buttons.html
  components-badges.html
  components-cards.html
  components-sidebar.html
  components-player-card.html
  components-risk-gauge.html
ui_kits/
  web/                       ← Web dashboard UI kit
    index.html
    Sidebar.jsx
    PlayerCard.jsx
    DashboardPage.jsx
    PlayersPage.jsx
  mobile/                    ← Mobile app UI kit
    index.html
```
