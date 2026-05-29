"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useLocaleStore, getMessages } from "@/lib/i18n";
import { ObservabilityBootstrap } from "@/lib/observability";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      })
  );
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Santiago">
      <QueryClientProvider client={queryClient}>
        <ObservabilityBootstrap />
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
