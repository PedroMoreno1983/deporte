import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "Deporte FC — Sports Platform",
    template: "%s · Deporte FC",
  },
  description:
    "Plataforma integral de gestión deportiva: jugadores, lesiones, wellness, táctica y predicciones de riesgo en tiempo real.",
  applicationName: "Deporte FC",
};

export const viewport: Viewport = {
  themeColor: "#020817",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(222 47% 9%)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "hsl(213 31% 91%)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
