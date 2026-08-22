import { Cluster, Stack, StackList } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { EngineeringCatalogue } from "../types";
import type { EngineeringIntelligence } from "../intelligence/types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

export function EngineeringFoundationScreen({
  catalogue,
  intelligence,
}: {
  catalogue: EngineeringCatalogue;
  intelligence: EngineeringIntelligence;
}) {
  return (
    <EngineeringFrame
      page="Foundation"
      title="Foundation Status"
      description="Foundation intelligence from FOUNDATION_CERTIFICATION_v1.1.md. Live CI is Unknown until connected."
    >
      <SectionCard title="Foundation intelligence" description={intelligence.foundation.evidence[0]}>
        <Stack gap="tight">
          <Cluster justify="start">
            <StatusLamp
              tone={
                /certified/i.test(intelligence.foundation.status) ? "healthy" : "unknown"
              }
            />
            <p className="ids-label text-foreground">{intelligence.foundation.status}</p>
          </Cluster>
          <p className="ids-caption">
            Version {intelligence.foundation.version} · {intelligence.foundation.date}
          </p>
          <p className="ids-caption">{catalogue.certification.programme}</p>
        </Stack>
      </SectionCard>

      <SectionCard title="Outstanding issues">
        <StackList>
          {intelligence.foundation.outstanding.map((item) => (
            <li key={item}>
              <p className="ids-body text-muted">{item}</p>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard title="Quality gates" description="Recorded snapshot. Not a live run.">
        <StackList>
          {intelligence.foundation.gates.map((gate) => (
            <li key={gate.gate}>
              <Cluster justify="between">
                <Stack gap="tight">
                  <p className="ids-label text-foreground">{gate.gate}</p>
                  <p className="ids-caption">{gate.result}</p>
                </Stack>
                <StatusLamp tone={gate.tone} />
              </Cluster>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard title="Quality intelligence" description={intelligence.quality.overall.evidence}>
        <StackList>
          {intelligence.quality.signals.map((signal) => (
            <li key={signal.id}>
              <Stack gap="tight">
                <p className="ids-label text-foreground">{signal.label}</p>
                <Cluster justify="between">
                  <p className="ids-caption">Live: {signal.live.detail}</p>
                  <StatusLamp tone={signal.live.tone} />
                </Cluster>
                <Cluster justify="between">
                  <p className="ids-caption">Recorded: {signal.recorded.detail}</p>
                  <StatusLamp tone={signal.recorded.tone} />
                </Cluster>
              </Stack>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard
        title="Architecture evidence"
        description={intelligence.architecture.verdict}
      >
        <StackList>
          {intelligence.architecture.evidence.map((line) => (
            <li key={line}>
              <p className="ids-body text-muted">{line}</p>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard title="Intelligence sources" description="Later Git, GitHub, CI, coverage, performance, security, and agents plug in here.">
        <StackList>
          {intelligence.sources.map((source) => (
            <li key={source.id}>
              <Cluster justify="between">
                <Stack gap="tight">
                  <p className="ids-label text-foreground">{source.kind}</p>
                  <p className="ids-caption">{source.note}</p>
                </Stack>
                <StatusLamp tone={source.available ? "healthy" : "unknown"}>
                  {source.available ? "Records" : "Unknown"}
                </StatusLamp>
              </Cluster>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard title="Certification history" description="Ready for later certifications.">
        <StackList>
          {intelligence.foundation.history.map((entry) => (
            <li key={`${entry.version}-${entry.date}`}>
              <p className="ids-label text-foreground">
                {entry.version} · {entry.status}
              </p>
              <p className="ids-caption">{entry.date}</p>
            </li>
          ))}
        </StackList>
      </SectionCard>
    </EngineeringFrame>
  );
}
