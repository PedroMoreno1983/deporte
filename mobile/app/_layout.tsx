import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { registerForPushNotifications, setupNotificationListeners } from "../lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    registerForPushNotifications().catch((e) => console.warn("[push]", e));
    const unsub = setupNotificationListeners({
      onResponse: (r) => {
        // Deep-link to player when notification has a player_id payload
        const data = r.notification.request.content.data as { player_id?: number } | undefined;
        if (data?.player_id) router.push(`/players/${data.player_id}` as any);
      },
    });
    return unsub;
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#020817" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#020817" } }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
