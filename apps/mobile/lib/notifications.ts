import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./messaging";

/**
 * Push registration. Called once after sign-in. The token lets the API alert
 * this device about new messages — the payload itself never contains PHI
 * (see buildPushNotification), so lock-screen previews are safe.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  const status =
    existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await registerPushToken(token);
  } catch {
    // Push is a convenience, not the channel — messaging works without it.
  }
}

/** Foreground presentation: show the banner even while the app is open. */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
