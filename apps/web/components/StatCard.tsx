export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "alert";
}) {
  return (
    <div className={`stat-card${tone === "alert" ? " alert" : ""}`}>
      <p className="value">{value}</p>
      <p className="label">{label}</p>
    </div>
  );
}
