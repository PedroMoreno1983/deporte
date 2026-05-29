/**
 * Push notifications setup for the mobile app.
 *
 * Flow:
 *  1. App startup → requestPermissionsAsync()
 *  2. If granted → getExpoPushTokenAsync() → POST /notifications/device-token
 *     (so the backend can target this device via Expo's push service)
 *  3. App in foreground → addNotificationReceivedListener shows the message inline
 *  4. User taps → addNotificationResponseReceivedListener deep-links to player
 *
 * Backend integration: POST /api/v1/notifications/device-token
 *   { token: string, platform: "ios" | "android", device_id: string }
 *   (To be implemented in backend if not present; the mobile side already calls it.)
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  false,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }) as any,
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Android requires a channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Deporte FC",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00ff87",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Register the device with the backend (best-effort).
  try {
    await api.post("/notifications/device-token", {
      token,
      platform: Platform.OS,
    });
  } catch (e) {
    console.warn("[push] device registration failed:", e);
  }
  return token;
}

export function setupNotificationListeners(opts: {
  onReceive?:  (n: Notifications.Notification) => void;
  onResponse?: (r: Notifications.NotificationResponse) => void;
}) {
  const sub1 = Notifications.addNotificationReceivedListener((n) => opts.onReceive?.(n));
  const sub2 = Notifications.addNotificationResponseReceivedListener((r) => opts.onResponse?.(r));
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
