/**
 * Today's visit schedule. Populated by the visits feature — the empty state
 * below is the honest UI until then.
 */
export function VisitsToday() {
  return (
    <section className="panel" aria-label="Today's visits">
      <h2>Today&apos;s visits</h2>
      <p className="hint">In-person, video, and phone visits for the care team.</p>
      <div className="empty">No visits scheduled for today.</div>
    </section>
  );
}
