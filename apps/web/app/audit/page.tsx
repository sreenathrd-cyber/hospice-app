"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { queryAuditLog, type WebAuditEntry, type WebSession } from "../../lib/web-api";
import { useSession } from "../../lib/session-context";

const RECORD_TYPES = [
  "user",
  "thread",
  "questionnaire_response",
  "alert",
  "visit",
  "visit_note",
  "sia_entry",
  "idg_session",
  "patient",
];

/** Admin-only audit trail: who accessed what PHI, when. */
export default function AuditPage() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const [entries, setEntries] = useState<WebAuditEntry[] | null>(null);
  const [recordType, setRecordType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (session: WebSession) => {
      const result = await queryAuditLog(session, recordType ? { recordType } : {});
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setEntries(result.value);
    },
    [recordType],
  );

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/login");
    else if (state.status === "signed-in") void load(state.session);
  }, [state, router, load]);

  if (state.status === "loading") return <main className="dashboard"><p className="hint">Loading…</p></main>;
  if (state.status === "signed-out") return null;
  const session = state.session;

  if (session.role !== "admin") {
    return (
      <main className="dashboard">
        <h1>Admins only</h1>
        <p className="hint">The audit trail is restricted to agency administrators.</p>
        <button className="link" onClick={() => router.push("/")}>Back to dashboard</button>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <div className="topbar">
        <div>
          <h1>Audit trail</h1>
          <div className="date">Who accessed what PHI, when. Record IDs only — never content.</div>
        </div>
        <div>
          <button className="link" onClick={() => router.push("/")} style={{ marginRight: 16 }}>
            Dashboard
          </button>
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="filters">
        <label>
          Record type{" "}
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
            <option value="">All</option>
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <button className="link" onClick={() => void load(session)}>Refresh</button>
      </div>

      {error && <p className="error">{error}</p>}
      {entries === null ? (
        <p className="hint">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="empty">No audit entries yet. Access PHI in the app and it will appear here.</div>
      ) : (
        <table className="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Record</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{formatTime(e.createdAt)}</td>
                <td>{e.actorName}</td>
                <td>{e.action}</td>
                <td>{e.recordType.replace(/_/g, " ")}</td>
                <td className="mono">{e.recordId === "list" ? "—" : `${e.recordId.slice(0, 8)}…`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
