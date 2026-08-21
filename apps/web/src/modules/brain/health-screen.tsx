import { brainHealth } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { HealthBand } from "./components/health-band";

export function BrainHealthScreen() {
  return (
    <BrainFrame
      page="Health"
      title="Brain health"
      description="Placeholder judgement of the catalogue. These metrics are not computed from a backend."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {brainHealth.map((item) => (
          <article key={item.id} className="ids-surface-card flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="ids-kicker">{item.title}</h2>
              <HealthBand band={item.band} />
            </div>
            <p className="ids-metric">{item.value}</p>
            <p className="ids-body max-w-[42rem] text-muted">{item.judgement}</p>
          </article>
        ))}
      </div>
    </BrainFrame>
  );
}
