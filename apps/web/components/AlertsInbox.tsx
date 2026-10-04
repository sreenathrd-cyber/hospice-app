"use client";

import { useCallback, useEffect, useState } from "react";
import type { AlertListItem } from "@repo/types";
import { acknowledgeAlert, listAlerts, type WebSession } from "../lib/web-api";

/**
 * Real alerts inbox. One effect loads the inbox when the session is ready;
 * acknowledge refreshes the list. Red flags sort first.
 */
export function AlertsInbox({ session, onCount }: { session: WebSession; onCount: (red: number) => void }) {
  const [alerts, setAlerts] = useState<AlertListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const result = await listAlerts(session);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    const sorted = [...result.value].sort((a, b) =>
      rank(a.severity) === rank(b.severity)
        ? b.createdAt.localeCompare(a.createdAt)
        : rank(a.severity) - rank(b.severity),
    );
    setAlerts(sorted);
    onCount(sorted.filter((a) => a.severity === "red").length);
  }, [session, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(id: string) {
    setWorking(true);
    const result = await acknowledgeAlert(session, id);
    setWorking(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  return (
    <section className="panel" aria-label="Alerts inbox">
      <div className="panel-head">
        <h2>Alerts inbox</h2>
        <button className="link" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {alerts === null ? (
        <p className="hint">Loading…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : alerts.length === 0 ? (
        <div className="empty">No unacknowledged alerts. You&apos;re all clear.</div>
      ) : (
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert severity-${a.severity}`}>
              <div className="alert-head">
                <strong>{a.patientName}</strong>
                <span className="severity">{a.severity.toUpperCase()}</span>
              </div>
              <div className="alert-message">{a.message}</div>
              <div className="alert-meta">
                {formatTime(a.createdAt)}
                <button
                  className="link"
                  disabled={working}
                  onClick={() => void acknowledge(a.id)}
                  aria-label={`Acknowledge alert for ${a.patientName}`}
                >
                  {working ? "Working…" : "Acknowledge"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function rank(s: AlertListItem["severity"]): number {
  return s === "red" ? 0 : s === "warning" ? 1 : 2;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
