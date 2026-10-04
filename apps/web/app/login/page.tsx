"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/web-api";
import { useSession } from "../../lib/session-context";

/** Team sign-in: email + password. */
export default function LoginPage() {
  const router = useRouter();
  const { state, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/");
  }, [state.status, router]);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const result = await login(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    signIn(result.value);
    router.replace("/");
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Team sign-in</h1>
        <p className="hint">Sign in with your work email and password.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <button onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
