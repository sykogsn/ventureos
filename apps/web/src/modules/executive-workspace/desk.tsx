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
  Inspector,
  InsetSurface,
  ReadingRegion,
  Stack,
} from "@/core/layout";
import { ConfidenceMeter } from "@/modules/frontend-foundation/signal";
import { PresentationRegion } from "@/modules/frontend-foundation/region";
import { StatusIndicator } from "@/modules/frontend-foundation/status";
import { BodyCopy, GroupTitle, MetaCopy } from "@/modules/frontend-foundation/typography";
import type {
  AttentionMatter,
  ExecutiveWorkspacePresentation,
  JudgementPresentation,
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

          <PresentationRegion title="Executive brief" note="What should I know right now?">
            <ReadingRegion size="lg">
              <Stack gap="compact">
                <GroupTitle>{model.brief.headline}</GroupTitle>
                <BodyCopy>{model.brief.narrative}</BodyCopy>
                {model.brief.implications.length > 0 ? (
                  <Stack gap="tight">
                    {model.brief.implications.map((point) => (
                      <MetaCopy key={point}>{point}</MetaCopy>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </ReadingRegion>
          </PresentationRegion>

          <PresentationRegion
            title="Requires your judgement"
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
              title="Matters requiring attention"
              note="Real recommendations. Not founder judgements."
            >
              <Stack gap="compact">
                {model.attention.map((item) => (
                  <AttentionItem
                    key={item.id}
                    matter={item}
                    selected={selection?.kind === "attention" && selection.id === item.id}
                    onSelect={() => setSelection({ kind: "attention", id: item.id })}
                  />
                ))}
              </Stack>
            </PresentationRegion>
          ) : null}

          <PresentationRegion
            title="Items to watch"
            note="Attention only. No judgement is required yet."
          >
            {model.watches.length === 0 ? (
              <EmptyCopy title="Nothing is on watch">
                Companies that need attention will appear here when operating health names them.
              </EmptyCopy>
            ) : (
              <Stack gap="compact">
                {model.watches.map((item) => (
                  <WatchItem
                    key={item.id}
                    item={item}
                    selected={selection?.kind === "watch" && selection.id === item.id}
                    onSelect={() => setSelection({ kind: "watch", id: item.id })}
                  />
                ))}
              </Stack>
            )}
          </PresentationRegion>
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
        {matter.significance ? <BodyCopy>{matter.significance}</BodyCopy> : null}
      </ChoiceFace>
      <InsetSurface>
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
      </InsetSurface>
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
      <MetaCopy>{matter.company}</MetaCopy>
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
        <MatterSignals matter={matter} />
        <GroupTitle>{matter.issue}</GroupTitle>
        <MetaCopy>{matter.company}</MetaCopy>
      </Stack>
      {matter.significance ? (
        <Stack gap="tight">
          <p className="ids-kicker">Significance</p>
          <BodyCopy>{matter.significance}</BodyCopy>
        </Stack>
      ) : null}
      <Stack gap="tight">
        <p className="ids-kicker">Decision context</p>
        <BodyCopy>{matter.decision}</BodyCopy>
        {"costOfInaction" in matter && matter.costOfInaction ? (
          <MetaCopy>If you wait. {matter.costOfInaction}</MetaCopy>
        ) : null}
      </Stack>
      {matter.evidence.length > 0 ? (
        <Stack gap="compact">
          <p className="ids-kicker">Evidence and trust</p>
          {matter.evidence.map((item) => (
            <Stack key={item.id} gap="tight">
              <p className="ids-label text-foreground">{item.label}</p>
              <MetaCopy>
                {item.source} · {item.detail}
              </MetaCopy>
            </Stack>
          ))}
        </Stack>
      ) : null}
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
          {matter.actionLabel}
        </Link>
      )}
    </Stack>
  );
}

function WatchInspector({ item }: { item: WatchPresentation }) {
  return (
    <Stack gap="compact">
      <p className="ids-kicker">Watch item</p>
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
