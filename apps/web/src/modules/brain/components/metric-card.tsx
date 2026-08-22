import { SectionCard } from "@/modules/dashboard/components/section-card";

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
    <SectionCard>
      <p className="ids-kicker">{kicker}</p>
      <p className="ids-metric">{value}</p>
      <p className="ids-body text-muted">{note}</p>
    </SectionCard>
  );
}
