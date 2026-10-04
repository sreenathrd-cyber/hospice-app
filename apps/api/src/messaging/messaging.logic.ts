import { isTeamRole, type MessageDirection, type UserRole } from "@repo/types";

/**
 * Pure messaging rules. No I/O — every access decision that touches the
 * database lives in the service; these are the rules both sides share.
 */

/** Which way a message flows, derived solely from the sender's role. */
export function resolveDirection(role: UserRole): MessageDirection {
  return isTeamRole(role) ? "team_to_family" : "family_to_team";
}

/** Expo push tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. */
export function isValidPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") && token.endsWith("]");
}
