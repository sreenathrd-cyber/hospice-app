"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isTeamRole, useSession } from "../lib/session-context";
import { StatCard } from "../components/StatCard";
import { AlertsInbox } from "../components/AlertsInbox";
import { VisitsToday } from "../components/VisitsToday";
import { SiaWidget } from "../components/SiaWidget";

/**
 * Care-team dashboard. Gated on a signed-in team session — family roles see
 * an honest "care team only" message instead of a broken dashboard.
 */
export default function DashboardPage() {
  return <GatedDashboard />;
}

function GatedDashboard() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const [redCount, setRedCount] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/login");
  }, [state.status, router]);

  if (state.status === "loading") {
    return (
      <main className="dashboard">
        <p className="hint">Loading…</p>
      </main>
    );
  }
  if (state.status === "signed-out") return null;

  const session = state.session;
  if (!isTeamRole(session.role)) {
    return (
      <main className="dashboard">
        <h1>Care team only</h1>
        <p className="hint">This dashboard is for clinicians and admins. Families use the mobile app.</p>
        <div>
          {session.role === "admin" && (
            <button className="link" onClick={() => router.push("/audit")} style={{ marginRight: 16 }}>
              Audit trail
            </button>
          )}
          <button className="link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="dashboard">
      <div className="topbar">
        <div>
          <h1>{session.agencyName} — Team dashboard</h1>
          <div className="date">{today}</div>
        </div>
        <button className="link" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="stats">
        <StatCard label="Active patients (census)" value="–" />
        <StatCard
          label="Unacknowledged red alerts"
          value={redCount === null ? "…" : String(redCount)}
          tone="alert"
        />
        <StatCard label="Visits today" value="0" />
        <StatCard label="SIA captured this week" value="$0.00" />
      </div>

      <div className="grid-2">
        <AlertsInbox session={session} onCount={setRedCount} />
        <VisitsToday />
      </div>

      <div className="grid-2">
        <SiaWidget />
      </div>
    </main>
  );
}
