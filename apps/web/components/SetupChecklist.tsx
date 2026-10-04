type Step = { label: string; detail: string; done: boolean };

/**
 * First-run setup checklist for a new agency. Each step reflects real system
 * state as features land — nothing here is decorative.
 */
export function SetupChecklist({ apiReachable }: { apiReachable: boolean }) {
  const steps: Step[] = [
    {
      label: "Connect the API",
      detail: "The NestJS backend is reachable and healthy.",
      done: apiReachable,
    },
    {
      label: "Add your Telnyx credentials",
      detail: "Set TELNYX_API_KEY and TELNYX_FROM_NUMBER in apps/api/.env for SMS and video.",
      done: false,
    },
    {
      label: "Invite your care team",
      detail: "Clinician sign-in arrives with Feature 1 (auth).",
      done: false,
    },
  ];

  return (
    <section className="panel" aria-label="Setup checklist">
      <h2>Get set up</h2>
      <p className="hint">Three steps to your first pilot visit.</p>
      <ul className="checklist">
        {steps.map((step) => (
          <li key={step.label}>
            <span className={`check${step.done ? " done" : ""}`} aria-hidden="true">
              {step.done ? "✓" : ""}
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{step.label}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{step.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
