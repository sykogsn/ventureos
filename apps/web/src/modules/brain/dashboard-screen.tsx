import Link from "next/link";
import {
  brainHealth,
  decisions,
  knowledgeObjects,
  recentActivity,
} from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { HealthBand } from "./components/health-band";
import { MetricCard } from "./components/metric-card";

const quickActions = [
  { href: "/brain/library/new", label: "New knowledge", primary: true },
  { href: "/brain/decisions", label: "New decision", primary: false },
  { href: "/brain/search", label: "Search", primary: false },
  { href: "/brain/library", label: "Browse library", primary: false },
] as const;

function rollupBand() {
  if (brainHealth.some((item) => item.band === "risk")) {
    return "risk" as const;
  }
  if (brainHealth.some((item) => item.band === "watch")) {
    return "watch" as const;
  }
  return "healthy" as const;
}

export function BrainDashboardScreen() {
  const band = rollupBand();
  const standards = knowledgeObjects.filter((item) => item.type === "Standard").length;
  const coverage = brainHealth.find((item) => item.id === "coverage");

  return (
    <BrainFrame
      page="Dashboard"
      title="Brain"
      description="Institutional intelligence for the desk. Not a document store."
      meta="v0.1"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="ids-surface-card flex flex-col gap-3 p-6">
          <p className="ids-kicker">Knowledge health</p>
          <div className="flex items-center gap-3">
            <p className="ids-metric capitalize">{band}</p>
            <HealthBand band={band} />
          </div>
          <p className="ids-body text-muted">
            {coverage?.judgement ?? "Coverage is the current judgement of this catalogue."}
          </p>
        </article>
        <MetricCard
          kicker="Total knowledge objects"
          value={String(knowledgeObjects.length)}
          note="Approved law, living research, and specified work in one catalogue."
        />
        <MetricCard
          kicker="Standards"
          value={String(standards)}
          note="IDS, engineering, and security as objects the desk can cite."
        />
        <MetricCard
          kicker="Architecture decisions"
          value={String(decisions.length)}
          note="Each ruling is a Knowledge Object of type Decision."
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
        <article className="ids-surface-card flex flex-col gap-5 p-6">
          <div>
            <p className="ids-kicker">Recent activity</p>
            <p className="ids-caption mt-1">What entered the catalogue.</p>
          </div>
          <ul className="flex flex-col">
            {recentActivity.map((item) => (
              <li
                key={item.id}
                className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <p className="ids-caption">{item.at}</p>
                <Link
                  href={item.href}
                  className="ids-label mt-2 block ids-transition underline-offset-4 hover:underline"
                >
                  {item.note}
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="ids-surface-card flex flex-col gap-5 p-6">
          <div>
            <p className="ids-kicker">Quick actions</p>
            <p className="ids-caption mt-1">Recording is not open in v0.1.</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={action.primary ? "vos-btn-primary" : "vos-btn-secondary"}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </article>
      </section>
    </BrainFrame>
  );
}
