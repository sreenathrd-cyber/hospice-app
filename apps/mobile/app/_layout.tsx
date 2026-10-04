import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { defaultTheme, isTeamRole, pushPayloadSchema } from "@repo/types";
import { SessionProvider, useSession } from "../lib/session-context";
import { ThemeProvider } from "../lib/theme";
import { configureForegroundNotifications } from "../lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

/**
 * Root gate: restores the SecureStore session, then routes by role.
 * Patients/caregivers → (patient), clinicians/admins → (team).
 * One app, two experiences — the sign-in role decides.
 */
function Gate() {
  const { state } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // useEffect ledger — reactive navigation guard. Runs only when the session
  // or route changes; the canonical expo-router auth pattern.
  useEffect(() => {
    if (state.status !== "ready") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (state.session.kind === "none") {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
    } else if (inAuthGroup) {
      router.replace(isTeamRole(state.session.value.role) ? "/(team)/home" : "/(patient)/home");
    }
  }, [state, segments, router]);

  // useEffect ledger — notification tap → deep link. Event subscription with
  // cleanup (not data fetching). The push data carries only a thread id —
  // the conversation loads after the tap, behind auth.
  useEffect(() => {
    configureForegroundNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const parsed = pushPayloadSchema.safeParse(response.notification.request.content.data);
      if (!parsed.success) return;
      if (state.status !== "ready" || state.session.kind === "none") return;
      const session = state.session.value;
      if (parsed.data.kind === "new_message") {
        const base = isTeamRole(session.role) ? "(team)" : "(patient)";
        router.push({ pathname: `/${base}/thread/[id]`, params: { id: parsed.data.threadId } });
      } else if (isTeamRole(session.role)) {
        // care_alert — alert pushes only go to the care team; land on team home
        router.push("/(team)/home");
      }
    });
    return () => sub.remove();
  }, [state, router]);

  if (state.status === "loading") return null;

  const theme = state.session.kind === "some" ? state.session.value.theme : { ...defaultTheme };

  return (
    <ThemeProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(patient)" />
        <Stack.Screen name="(team)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </QueryClientProvider>
  );
}
