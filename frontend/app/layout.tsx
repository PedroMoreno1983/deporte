import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Deporte FC | Plataforma de Gestión",
  description: "Sistema integral de gestión de jugadores de fútbol",
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
