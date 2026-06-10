import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "Deporte FC — Cuaderno del plantel",
    template: "%s · Deporte FC",
  },
  description:
    "Plataforma integral de gestión deportiva: jugadores, lesiones, wellness, táctica y predicciones de riesgo — un cuaderno cálido y hecho a mano.",
  applicationName: "Deporte FC",
};

export const viewport: Viewport = {
  themeColor: "#f0e5d0",
};

// Apply the saved theme/tweaks before first paint to avoid a flash.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("lupi-tweaks");var s=t?JSON.parse(t):{};var r=document.documentElement;r.setAttribute("data-theme",s.dark?"dark":"light");r.setAttribute("data-palette",s.palette||"terracota");r.setAttribute("data-density",s.density||"normal");r.setAttribute("data-hand",s.handDrawn===false?"off":"on");if(s.fontScale){r.style.setProperty("--font-scale",(s.fontScale/100));}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <div className="paper-grain" />
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--paper-card)",
                border: "1.5px solid var(--rule)",
                borderRadius: "4px",
                color: "var(--ink)",
                fontFamily: "var(--serif)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
