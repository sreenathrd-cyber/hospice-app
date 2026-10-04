import { z } from "zod";
import * as SecureStore from "expo-secure-store";
import {
  agencyThemeSchema,
  none,
  some,
  tenantIdSchema,
  userIdSchema,
  userRoleSchema,
  type Option,
} from "@repo/types";

const SESSION_KEY = "hospice.session";

const sessionSchema = z.object({
  token: z.string().min(1),
  userId: userIdSchema,
  role: userRoleSchema,
  tenantId: tenantIdSchema,
  theme: agencyThemeSchema,
});
export type Session = z.infer<typeof sessionSchema>;

/**
 * Auth session lives ONLY in SecureStore (Keychain on iOS, Keystore on
 * Android). Never in AsyncStorage, never in logs, never in the bundle.
 * Absence is Option<Session> — callers handle both cases explicitly.
 */
export async function getSession(): Promise<Option<Session>> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw === null) return none();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return none();
  }
  const parsed = sessionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return none();
  }
  return some(parsed.data);
}

export async function setSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
