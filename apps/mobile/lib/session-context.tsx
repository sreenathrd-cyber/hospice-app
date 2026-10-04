import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { none, type Option } from "@repo/types";
import {
  clearSession as clearStoredSession,
  getSession,
  type Session,
} from "./session";

type SessionState = { status: "loading" } | { status: "ready"; session: Option<Session> };

type SessionContextValue = {
  state: SessionState;
  /** Re-read the session from SecureStore (call after sign-in). */
  refresh: () => Promise<void>;
  /** Clear the session (call on sign out). The gate routes to sign-in. */
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Single owner of session state. Screens never juggle SecureStore + router
 * themselves — they call refresh()/signOut() and the root gate reacts.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async () => {
    setState({ status: "ready", session: await getSession() });
  }, []);

  // useEffect ledger — one-shot async session restore on mount. SecureStore
  // is async-only; no synchronous read exists. No data fetching.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    setState({ status: "ready", session: none() });
  }, []);

  return (
    <SessionContext.Provider value={{ state, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
