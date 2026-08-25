"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { FounderCallAction } from "@/modules/intelligence/founder-call-action";
import {
  ChoiceFace,
  Cluster,
  Desk,
  Flow,
  Hairline,
  Inspector,
  ReadingRegion,
  Stack,
  StackList,
} from "@/core/layout";
import { ConfidenceMeter } from "@/modules/frontend-foundation/signal";
import { PresentationRegion } from "@/modules/frontend-foundation/region";
import { StatusIndicator } from "@/modules/frontend-foundation/status";
import { BodyCopy, GroupTitle, MetaCopy } from "@/modules/frontend-foundation/typography";
import type {
  AttentionMatter,
  ExecutiveWorkspacePresentation,
  JudgementPresentation,
  PresentationEvidence,
  WatchPresentation,
} from "./types";

type Selection =
  | { kind: "primary" }
  | { kind: "attention"; id: string }
  | { kind: "watch"; id: string };

export function ExecutiveWorkspaceDesk({
  model,
}: {
  model: ExecutiveWorkspacePresentation;
}) {
  const initial = useMemo<Selection | null>(() => {
    if (model.primary) {
      return { kind: "primary" };
    }
    if (model.attention[0]) {
      return { kind: "attention", id: model.attention[0].id };
    }
    if (model.watches[0]) {
      return { kind: "watch", id: model.watches[0].id };
    }
    return null;
  }, [model.attention, model.primary, model.watches]);

  const [selection, setSelection] = useState<Selection | null>(initial);

  const selectedJudgement =
    selection?.kind === "primary"
      ? model.primary
      : selection?.kind === "attention"
        ? (model.attention.find((item) => item.id === selection.id) ?? null)
        : null;
  const selectedWatch =
    selection?.kind === "watch"
      ? (model.watches.find((item) => item.id === selection.id) ?? null)
      : null;

  return (
    <Desk>
      <Flow>
        <Stack gap="section">
          <MetaCopy>
            {model.founderName} · {model.posture}
          </MetaCopy>

          <PresentationRegion
            title="Executive Brief"
            note="What requires my attention or decision now?"
          >
            <ReadingRegion size="lg">
              <Stack gap="compact">
                <p className="ids-subhead">{model.brief.headline}</p>
                <BodyCopy>{model.brief.narrative}</BodyCopy>
                {model.brief.implications.length > 0 ? (
                  <Hairline space="tight">
                    <Stack gap="tight">
                      {model.brief.implications.map((point) => (
                        <MetaCopy key={point}>{point}</MetaCopy>
                      ))}
                    </Stack>
                  </Hairline>
                ) : null}
              </Stack>
            </ReadingRegion>
          </PresentationRegion>

          <PresentationRegion
            title="Primary Judgement"
            note="VentureOS presents the decision. It does not make it."
          >
            {model.primary ? (
              <PrimaryJudgement
                matter={model.primary}
                selected={selection?.kind === "primary"}
                onSelect={() => setSelection({ kind: "primary" })}
              />
            ) : (
              <EmptyCopy title="No call is waiting">
                The next founder judgement will appear here when policy evaluation has a
                recommendation.
              </EmptyCopy>
            )}
          </PresentationRegion>

          {model.attention.length > 0 ? (
            <PresentationRegion
              title="Also Requires Awareness"
              note="Real recommendations. Not founder judgements."
            >
              <StackList as="div">
                {model.attention.map((item) => (
                  <AttentionItem
                    key={item.id}
                    matter={item}
                    selected={selection?.kind === "attention" && selection.id === item.id}
                    onSelect={() => setSelection({ kind: "attention", id: item.id })}
                  />
                ))}
              </StackList>
            </PresentationRegion>
          ) : null}

          <PresentationRegion
            title="Watches"
            note="Monitoring only. No judgement is required yet."
          >
            {model.watches.length === 0 ? (
              <EmptyCopy title="Nothing is on watch">
                Companies that need attention will appear here when operating health names them.
              </EmptyCopy>
            ) : (
              <StackList as="div">
                {model.watches.map((item) => (
                  <WatchItem
                    key={item.id}
                    item={item}
                    selected={selection?.kind === "watch" && selection.id === item.id}
                    onSelect={() => setSelection({ kind: "watch", id: item.id })}
                  />
                ))}
              </StackList>
            )}
          </PresentationRegion>

          {selectedJudgement ? (
            <EvidenceRegion matter={selectedJudgement} />
          ) : null}
        </Stack>
      </Flow>
      <Inspector>
        {selectedJudgement ? (
          <JudgementInspector matter={selectedJudgement} founderCall={selection?.kind === "primary"} />
        ) : selectedWatch ? (
          <WatchInspector item={selectedWatch} />
        ) : (
          <EmptyCopy kicker="Context panel" title="Reserved slot">
            Select a judgement or watch item. No inspector feed is invented.
          </EmptyCopy>
        )}
      </Inspector>
    </Desk>
  );
}

function PrimaryJudgement({
  matter,
  selected,
  onSelect,
}: {
  matter: JudgementPresentation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Stack gap="compact">
      <ChoiceFace selected={selected} aria-pressed={selected} onClick={onSelect}>
        <MatterSignals matter={matter} />
        <p className="ids-heading">{matter.issue}</p>
        <MetaCopy>{matter.company}</MetaCopy>
        {matter.significance ? <BodyCopy>{matter.significance}</BodyCopy> : null}
      </ChoiceFace>
      <Hairline space="compact">
        <Stack gap="compact">
          <p className="ids-kicker">Decision required</p>
          <p className="ids-label text-foreground">{matter.decision}</p>
          {matter.costOfInaction ? (
            <MetaCopy>If you wait. {matter.costOfInaction}</MetaCopy>
          ) : null}
          <FounderCallAction
            href={matter.actionHref}
            decisionId={matter.id}
            ventureId={matter.ventureId}
            ruling={matter.ruling ?? matter.decision}
          >
            {matter.actionLabel}
          </FounderCallAction>
        </Stack>
      </Hairline>
    </Stack>
  );
}

function AttentionItem({
  matter,
  selected,
  onSelect,
}: {
  matter: AttentionMatter;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ChoiceFace selected={selected} aria-pressed={selected} onClick={onSelect}>
      <MatterSignals matter={matter} />
      <p className="ids-label text-foreground">{matter.issue}</p>
      <MetaCopy>
        {matter.company}
        {matter.significance ? ` · ${matter.significance}` : ""}
      </MetaCopy>
    </ChoiceFace>
  );
}

function WatchItem({
  item,
  selected,
  onSelect,
}: {
  item: WatchPresentation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ChoiceFace selected={selected} aria-pressed={selected} onClick={onSelect}>
      <StatusIndicator level={item.band} />
      <p className="ids-label text-foreground">{item.company}</p>
      <MetaCopy>{item.judgement}</MetaCopy>
    </ChoiceFace>
  );
}

function MatterSignals({
  matter,
}: {
  matter: Pick<JudgementPresentation, "severity" | "confidence">;
}) {
  return (
    <Cluster justify="start">
      <StatusIndicator level={matter.severity} />
      {matter.confidence ? <ConfidenceMeter level={matter.confidence} /> : null}
    </Cluster>
  );
}

function EvidenceRegion({
  matter,
}: {
  matter: JudgementPresentation | AttentionMatter;
}) {
  return (
    <PresentationRegion
      title="Evidence & Trust"
      note="Recorded production fields only. Provenance and freshness are not invented."
    >
      <Stack gap="compact">
        {matter.confidence ? <ConfidenceMeter level={matter.confidence} /> : null}
        <EvidenceList evidence={matter.evidence} />
      </Stack>
    </PresentationRegion>
  );
}

function EvidenceList({ evidence }: { evidence: PresentationEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <EmptyCopy title="No recorded supporting evidence">
        Confidence is shown when policy recorded it. Provenance, freshness, and contradiction
        are omitted because production does not supply them.
      </EmptyCopy>
    );
  }

  return (
    <Stack gap="compact">
      {evidence.map((item) => (
        <Stack key={item.id} gap="tight">
          <p className="ids-label text-foreground">{item.label}</p>
          <MetaCopy>
            {item.source} · {item.detail}
          </MetaCopy>
        </Stack>
      ))}
    </Stack>
  );
}

function JudgementInspector({
  matter,
  founderCall,
}: {
  matter: JudgementPresentation | AttentionMatter;
  founderCall: boolean;
}) {
  return (
    <Stack gap="section">
      <Stack gap="compact">
        <p className="ids-kicker">Selected matter</p>
        <MatterSignals matter={matter} />
        <GroupTitle>{matter.issue}</GroupTitle>
        <MetaCopy>{matter.company}</MetaCopy>
      </Stack>
      {matter.significance ? (
        <Hairline space="tight">
          <Stack gap="tight">
            <p className="ids-kicker">Significance</p>
            <BodyCopy>{matter.significance}</BodyCopy>
          </Stack>
        </Hairline>
      ) : null}
      <Hairline space="tight">
        <Stack gap="tight">
          <p className="ids-kicker">Decision context</p>
          <BodyCopy>{matter.decision}</BodyCopy>
          {"costOfInaction" in matter && matter.costOfInaction ? (
            <MetaCopy>If you wait. {matter.costOfInaction}</MetaCopy>
          ) : null}
        </Stack>
      </Hairline>
      {matter.evidence.length > 0 ? (
        <Hairline space="tight">
          <Stack gap="compact">
            <p className="ids-kicker">Evidence & Trust</p>
            <EvidenceList evidence={matter.evidence} />
          </Stack>
        </Hairline>
      ) : (
        <Hairline space="tight">
          <p className="ids-caption">
            No recorded supporting evidence is attached to this matter.
          </p>
        </Hairline>
      )}
      {founderCall && "actionHref" in matter ? (
        <FounderCallAction
          href={matter.actionHref}
          decisionId={matter.id}
          ventureId={"ventureId" in matter ? matter.ventureId : undefined}
          ruling={"ruling" in matter ? matter.ruling ?? matter.decision : matter.decision}
        >
          {matter.actionLabel}
        </FounderCallAction>
      ) : (
        <Link href={matter.actionHref} className="ids-caption ids-transition hover:text-foreground">
          Inspect
        </Link>
      )}
    </Stack>
  );
}

function WatchInspector({ item }: { item: WatchPresentation }) {
  return (
    <Stack gap="compact">
      <p className="ids-kicker">Watch</p>
      <StatusIndicator level={item.band} />
      <GroupTitle>{item.company}</GroupTitle>
      <BodyCopy>{item.judgement}</BodyCopy>
      <MetaCopy>{item.ask}</MetaCopy>
      <Link href={item.companyHref} className="ids-caption ids-transition hover:text-foreground">
        Open company desk
      </Link>
    </Stack>
  );
}
