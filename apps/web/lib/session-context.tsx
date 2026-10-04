"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearSession, loadSession, saveSession, type WebSession } from "./web-api";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: WebSession };

const SessionContext = createContext<{
  state: SessionState;
  signIn: (session: WebSession) => void;
  signOut: () => void;
}>({
  state: { status: "loading" },
  signIn: () => {},
  signOut: () => {},
});

/**
 * Web session provider. One effect hydrates the session from localStorage on
 * mount — the only client-side auth read; everything else flows through it.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const session = loadSession();
    setState(session ? { status: "signed-in", session } : { status: "signed-out" });
  }, []);

  const signIn = useCallback((session: WebSession) => {
    saveSession(session);
    setState({ status: "signed-in", session });
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setState({ status: "signed-out" });
  }, []);

  return <SessionContext.Provider value={{ state, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** The dashboard is care-team only — family roles land here, honestly. */
export function isTeamRole(role: string): boolean {
  return role === "clinician" || role === "admin";
}
