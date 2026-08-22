import { Cluster, Stack, StackList } from "@/core/layout";
import { SectionCard } from "@/modules/dashboard/components/section-card";
import type { EngineeringCatalogue } from "../types";
import { EngineeringFrame } from "../components/engineering-frame";
import { StatusLamp } from "../components/status-lamp";

export function EngineeringReleasesScreen({
  catalogue,
}: {
  catalogue: EngineeringCatalogue;
}) {
  const current = catalogue.releases[0];
  const gates = catalogue.certification.gates;
  const ready = /certified/i.test(catalogue.certification.status);

  return (
    <EngineeringFrame
      page="Releases"
      title="Release Centre"
      description="Display only. No tagging, no GitHub Release, no publish action. History is RELEASE_HISTORY.md."
    >
      <SectionCard title="Current release" description="Named in Engineering Records.">
        <Stack gap="tight">
          <p className="ids-metric">{current?.name ?? "None named"}</p>
          <Cluster justify="start">
            <StatusLamp tone={ready ? "healthy" : "watch"}>
              {current?.status ?? "Unknown"}
            </StatusLamp>
            <p className="ids-caption">{current?.date}</p>
          </Cluster>
          <p className="ids-body text-muted">{current?.notes}</p>
        </Stack>
      </SectionCard>

      <SectionCard title="Readiness" description="Approval is recorded in certification, not performed here.">
        <Cluster justify="start">
          <StatusLamp tone={ready ? "healthy" : "risk"}>
            {ready ? "Approved" : "Not approved"}
          </StatusLamp>
          <p className="ids-body text-muted">
            Quality gates below are the certification snapshot. This page cannot cut a release.
          </p>
        </Cluster>
      </SectionCard>

      <SectionCard title="Quality gates">
        <StackList>
          {gates.map((gate) => (
            <li key={gate.gate}>
              <Cluster justify="between">
                <p className="ids-label text-foreground">{gate.gate}</p>
                <StatusLamp tone={gate.tone} />
              </Cluster>
            </li>
          ))}
        </StackList>
      </SectionCard>

      <SectionCard title="Release history">
        <StackList>
          {catalogue.releases.map((item) => (
            <li key={`${item.name}-${item.date}`}>
              <Stack gap="tight">
                <p className="ids-label text-foreground">{item.name}</p>
                <p className="ids-caption">
                  {item.status} · {item.date}
                </p>
                <p className="ids-body text-muted">{item.notes}</p>
              </Stack>
            </li>
          ))}
        </StackList>
      </SectionCard>
    </EngineeringFrame>
  );
}
