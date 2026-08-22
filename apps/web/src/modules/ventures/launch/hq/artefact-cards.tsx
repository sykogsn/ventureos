import { ventureHasFeature } from "@/core/venture-definition/enforcement";
import { sortRecommendations } from "@/core/recommendation/model";
import type { FoundedCompany } from "../types";
import type { MissionTask } from "@/core/mission-engine";
import type { IntelligentDocument } from "@/core/document-intelligence";
import {
  knowledgeNoteViews,
  seatedOfficeViews,
} from "@/core/venture";
import Link from "next/link";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";
import { SectionCard, SectionHeading } from "@/modules/dashboard/components/section-card";
import { HealthPill } from "@/modules/dashboard/components/pills";
import { EmptyCopy } from "@/core/shell/empty-copy";
import {
  Cluster,
  Fit,
  Grid,
  Hairline,
  InsetSurface,
  Stack,
  Stretch,
  TaskRow,
} from "@/core/layout";

export function FounderHqCard({ company }: { company: FoundedCompany }) {
  const recommendation = sortRecommendations(company.venture.recommendations.items)[0];

  return (
    <SectionCard>
      <SectionHeading title="Founder HQ" subtitle="Live" />
      <p className="ids-body text-muted">{company.venture.identity.hqSummary}</p>
      {recommendation ? (
        <Hairline space="compact">
          <Stack gap="tight">
            <p className="ids-kicker">Recommendation Engine</p>
            <p className="ids-caption">
              {recommendation.originatingPolicyTitle} · {recommendation.policySeverity} ·{" "}
              {recommendation.policyOwner}
            </p>
            <p className="ids-label">{recommendation.title}</p>
            <p className="ids-body text-muted">
              <span className="ids-emphasis text-foreground">Finding. </span>
              {recommendation.finding}
            </p>
            <p className="ids-body text-foreground">{recommendation.recommendedAction}</p>
            <p className="ids-body text-muted">{recommendation.reason}</p>
            <p className="ids-caption">
              {recommendation.confidenceLabel} · {recommendation.confidence}% ·{" "}
              {recommendation.estimatedEffort} · consensus{" "}
              {recommendation.executiveConsensus.label}
            </p>
            <FounderCallAction
              href={recommendation.actionHref}
              decisionId={
                ventureHasFeature(company.venture, "founder-decisions")
                  ? recommendation.id
                  : undefined
              }
              ventureId={recommendation.ventureId}
              ruling={recommendation.recommendedAction}
            >
              {recommendation.actionLabel}
            </FounderCallAction>
          </Stack>
        </Hairline>
      ) : null}
    </SectionCard>
  );
}

export function VentureGenomeCard({ company }: { company: FoundedCompany }) {
  const genome = company.venture.genome;

  return (
    <SectionCard>
      <SectionHeading title="Venture Genome" subtitle="Inferred at founding" />
      <p className="ids-label">{genome.thesis}</p>
      <Grid variant="pair">
        {[
          ["Category", genome.category],
          ["Stage", genome.stage],
          ["Goal", genome.goal],
          ["Posture", genome.posture === "ai-native" ? "AI-native" : "Human-led"],
          ["Risk", genome.risk],
          ["Cadence", genome.cadence],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="ids-kicker">{label}</dt>
            <dd className="ids-body">{value}</dd>
          </div>
        ))}
      </Grid>
      <p className="ids-body text-muted">{genome.motion}</p>
    </SectionCard>
  );
}

export function OperatingHealthArtefact({ company }: { company: FoundedCompany }) {
  const health = company.venture.health;

  return (
    <Stretch>
      <SectionCard>
        <SectionHeading title="Operating Health" />
        <Cluster justify="between">
          <Stack gap="tight">
            <p className="ids-metric">{health.score}</p>
            <p className="ids-caption">{health.label}</p>
          </Stack>
          <HealthPill band={health.band} />
        </Cluster>
        <p className="ids-body text-muted">{health.summary}</p>
      </SectionCard>
    </Stretch>
  );
}

export function ExecutiveOfficeCard({ company }: { company: FoundedCompany }) {
  const office = company.venture.executiveOffice;
  const seated = seatedOfficeViews(office);

  return (
    <Stretch>
      <SectionCard>
        <SectionHeading
          title="Executive Office"
          subtitle={office.enabled ? "Seated at founding" : "Closed at founding"}
          action={
            <Link
              href={`/ventures/${company.venture.identity.id}/agents`}
              className="ids-caption vos-link"
            >
              Open floor
            </Link>
          }
        />
        {seated.length === 0 ? (
          <EmptyCopy
            title="No seats were filled"
            action={
              <Fit>
                <Link href="/dashboard" className="vos-btn-secondary">
                  Open Situation Room
                </Link>
              </Fit>
            }
          >
            The floor is closed until you seat executives at founding. Situation Room still runs the
            company.
          </EmptyCopy>
        ) : (
          <Stack gap="tight">
            {seated.map((seat) => (
              <InsetSurface key={seat.id}>
                <Stack gap="tight">
                  <p className="ids-label">{seat.label}</p>
                  <p className="ids-caption">{seat.description}</p>
                </Stack>
              </InsetSurface>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stretch>
  );
}

export function SprintOneCard({ company }: { company: FoundedCompany }) {
  const sprint = company.venture.mission.sprint;

  return (
    <SectionCard>
      <SectionHeading title="Sprint 1" subtitle={sprint.name} />
      <p className="ids-body">{sprint.objective}</p>
      <ul>
        {sprint.tasks.map((task: MissionTask, index: number) => (
          <TaskRow key={task.id}>
            <span className="ids-body">
              <span className="text-muted">{index + 1}. </span>
              {task.title}
            </span>
            <span className="ids-caption">{task.owner}</span>
          </TaskRow>
        ))}
      </ul>
    </SectionCard>
  );
}

export function CompanyStoryCard({ company }: { company: FoundedCompany }) {
  const story = company.venture.story;

  return (
    <Stretch>
      <SectionCard>
        <SectionHeading title="Company Story" />
        <Stack gap="compact">
          <p className="ids-body">{story.origin}</p>
          <p className="ids-body text-muted">{story.thesis}</p>
          <p className="ids-body text-muted">{story.promise}</p>
        </Stack>
      </SectionCard>
    </Stretch>
  );
}

export function KnowledgeBaseCard({ company }: { company: FoundedCompany }) {
  const notes = knowledgeNoteViews(company.venture);

  return (
    <Stretch>
      <SectionCard>
        <SectionHeading title="Knowledge Base" />
        {notes.length === 0 ? (
          <EmptyCopy title="Knowledge will accumulate">
            Founding notes and later judgements will be kept here as the company learns.
          </EmptyCopy>
        ) : (
          <Stack gap="compact">
            {notes.map((note) => (
              <InsetSurface key={note.id}>
                <Stack gap="tight">
                  <p className="ids-label">{note.title}</p>
                  <p className="ids-caption">{note.body}</p>
                </Stack>
              </InsetSurface>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stretch>
  );
}

export function SuggestedDocumentsCard({ company }: { company: FoundedCompany }) {
  return (
    <SectionCard>
      <SectionHeading title="Suggested Documents" />
      {company.venture.documents.documents.length === 0 ? (
        <EmptyCopy title="Documents will be suggested at founding">
          The founding pack appears here once the company exists. This is not a second document
          system.
        </EmptyCopy>
      ) : (
        <Grid variant="pair">
          {company.venture.documents.documents.map((doc: IntelligentDocument) => (
            <InsetSurface key={doc.id}>
              <Cluster justify="between">
                <span className="ids-label">{doc.title}</span>
                <span className="ids-caption">{doc.kind}</span>
              </Cluster>
            </InsetSurface>
          ))}
        </Grid>
      )}
    </SectionCard>
  );
}

export function ArtefactIndex({ company }: { company: FoundedCompany }) {
  const items = [
    "Founder HQ",
    "Venture Genome",
    ventureHasFeature(company.venture, "executive-office") ? "Executive Office" : null,
    company.venture.mission.sprint.name,
    "Company Story",
    "Knowledge Base",
    "Suggested Documents",
    "Operating Health",
  ].filter((item): item is string => Boolean(item));

  return (
    <SectionCard>
      <SectionHeading title="Launch sequence" subtitle="Every artefact is live" />
      <Cluster justify="start">
        {items.map((item) => (
          <span key={item} className="ids-chip">
            {item}
          </span>
        ))}
      </Cluster>
    </SectionCard>
  );
}
