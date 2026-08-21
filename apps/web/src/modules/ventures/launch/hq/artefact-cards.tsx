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

export function FounderHqCard({ company }: { company: FoundedCompany }) {
  const recommendation = sortRecommendations(company.venture.recommendations.items)[0];

  return (
    <SectionCard>
      <SectionHeading title="Founder HQ" subtitle="Live" />
      <p className="ids-body text-muted">{company.venture.identity.hqSummary}</p>
      {recommendation ? (
        <div className="border-t border-border pt-4">
          <p className="ids-kicker">Recommendation Engine</p>
          <p className="ids-caption mt-1">
            {recommendation.originatingPolicyTitle} · {recommendation.policySeverity} ·{" "}
            {recommendation.policyOwner}
          </p>
          <p className="ids-label mt-2">{recommendation.title}</p>
          <p className="ids-body mt-2 text-muted">
            <span className="ids-emphasis text-foreground">Finding. </span>
            {recommendation.finding}
          </p>
          <p className="ids-body mt-2 text-foreground">{recommendation.recommendedAction}</p>
          <p className="ids-body mt-2 text-muted">{recommendation.reason}</p>
          <p className="ids-caption mt-2">
            {recommendation.confidenceLabel} · {recommendation.confidence}% ·{" "}
            {recommendation.estimatedEffort} · consensus{" "}
            {recommendation.executiveConsensus.label}
          </p>
          <div className="mt-3">
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
          </div>
        </div>
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
      <dl className="grid gap-4 sm:grid-cols-2">
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
            <dd className="ids-body mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="ids-body text-muted">{genome.motion}</p>
    </SectionCard>
  );
}

export function OperatingHealthArtefact({ company }: { company: FoundedCompany }) {
  const health = company.venture.health;

  return (
    <SectionCard className="h-full">
      <SectionHeading title="Operating Health" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="ids-metric">{health.score}</p>
          <p className="ids-caption mt-1">{health.label}</p>
        </div>
        <HealthPill band={health.band} />
      </div>
      <p className="ids-body text-muted">{health.summary}</p>
    </SectionCard>
  );
}

export function ExecutiveOfficeCard({ company }: { company: FoundedCompany }) {
  const office = company.venture.executiveOffice;
  const seated = seatedOfficeViews(office);

  return (
    <SectionCard className="h-full">
      <SectionHeading
        title="Executive Office"
        subtitle={office.enabled ? "Seated at founding" : "Closed at founding"}
        action={
          <Link
            href={`/ventures/${company.venture.identity.id}/agents`}
            className="ids-caption vos-link shrink-0"
          >
            Open floor
          </Link>
        }
      />
      {seated.length === 0 ? (
        <EmptyCopy
          title="No seats were filled"
          action={
            <Link href="/dashboard" className="vos-btn-secondary w-fit">
              Open Situation Room
            </Link>
          }
        >
          The floor is closed until you seat executives at founding. Situation Room still runs the
          company.
        </EmptyCopy>
      ) : (
        <div className="grid gap-2">
          {seated.map((seat) => (
            <div key={seat.id} className="ids-surface-elevated p-3">
              <p className="ids-label">{seat.label}</p>
              <p className="ids-caption mt-1">{seat.description}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function SprintOneCard({ company }: { company: FoundedCompany }) {
  const sprint = company.venture.mission.sprint;

  return (
    <SectionCard>
      <SectionHeading title="Sprint 1" subtitle={sprint.name} />
      <p className="ids-body">{sprint.objective}</p>
      <ul className="flex flex-col">
        {sprint.tasks.map((task: MissionTask, index: number) => (
          <li
            key={task.id}
            className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0"
          >
            <span className="ids-body">
              <span className="text-muted">{index + 1}. </span>
              {task.title}
            </span>
            <span className="ids-caption shrink-0">{task.owner}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function CompanyStoryCard({ company }: { company: FoundedCompany }) {
  const story = company.venture.story;

  return (
    <SectionCard className="h-full">
      <SectionHeading title="Company Story" />
      <div className="flex flex-col gap-3">
        <p className="ids-body">{story.origin}</p>
        <p className="ids-body text-muted">{story.thesis}</p>
        <p className="ids-body text-muted">{story.promise}</p>
      </div>
    </SectionCard>
  );
}

export function KnowledgeBaseCard({ company }: { company: FoundedCompany }) {
  const notes = knowledgeNoteViews(company.venture);

  return (
    <SectionCard className="h-full">
      <SectionHeading title="Knowledge Base" />
      {notes.length === 0 ? (
        <EmptyCopy title="Knowledge will accumulate">
          Founding notes and later judgements will be kept here as the company learns.
        </EmptyCopy>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="ids-surface-elevated p-3">
              <p className="ids-label">{note.title}</p>
              <p className="ids-caption mt-1">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
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
        <ul className="grid gap-2 sm:grid-cols-2">
          {company.venture.documents.documents.map((doc: IntelligentDocument) => (
            <li
              key={doc.id}
              className="flex items-center justify-between ids-surface-elevated p-3"
            >
              <span className="ids-label">{doc.title}</span>
              <span className="ids-caption">{doc.kind}</span>
            </li>
          ))}
        </ul>
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
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="ids-chip">
            {item}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
