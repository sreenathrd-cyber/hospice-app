import { SIA_RATE_PER_UNIT_DOLLARS } from "@repo/types";

/**
 * SIA capture widget. Qualifying in-person RN/MSW visits in the last 7 days
 * of life convert to 15-minute units at $17.44/unit (4-hour daily cap).
 * Populated by Feature 6 (SIA visit timer).
 */
export function SiaWidget() {
  return (
    <section className="panel" aria-label="SIA capture">
      <h2>SIA capture — this week</h2>
      <p className="hint">
        15-minute units at ${SIA_RATE_PER_UNIT_DOLLARS.toFixed(2)}/unit. Video visits never count.
      </p>
      <div className="empty">No qualifying visits recorded this week.</div>
    </section>
  );
}
