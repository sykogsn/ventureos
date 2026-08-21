export function MetricCard({
  kicker,
  value,
  note,
}: {
  kicker: string;
  value: string;
  note: string;
}) {
  return (
    <article className="ids-surface-card flex flex-col gap-3 p-6">
      <p className="ids-kicker">{kicker}</p>
      <p className="ids-metric">{value}</p>
      <p className="ids-body text-muted">{note}</p>
    </article>
  );
}
