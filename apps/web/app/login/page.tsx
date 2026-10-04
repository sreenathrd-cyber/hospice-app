"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestCode, verifyCode } from "../../lib/web-api";
import { useSession } from "../../lib/session-context";

/** Team sign-in: phone number → SMS code, same flow as the mobile app. */
export default function LoginPage() {
  const router = useRouter();
  const { state, signIn } = useSession();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/");
  }, [state.status, router]);

  async function sendCode() {
    setError(null);
    setBusy(true);
    const result = await requestCode(phone.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setStep("code");
  }

  async function submitCode() {
    setError(null);
    setBusy(true);
    const result = await verifyCode(phone.trim(), code.trim());
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
        <p className="hint">Use the phone number your agency registered for you.</p>

        {step === "phone" ? (
          <>
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              placeholder="+12695550140"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <button onClick={sendCode} disabled={busy || phone.trim().length < 8}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="code">6-digit code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
            <button onClick={submitCode} disabled={busy || code.trim().length !== 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button className="link" onClick={() => setStep("phone")}>
              Use a different number
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
