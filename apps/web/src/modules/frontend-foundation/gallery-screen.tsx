import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { EmptyCopy } from "@/core/shell/empty-copy";
import {
  Desk,
  Flow,
  Grid,
  Inspector,
  Stack,
} from "@/core/layout";
import { EngineeringFrame } from "@/modules/engineering-hq/components/engineering-frame";
import { FoundationLedger } from "./data-table";
import { ErrorState } from "./error-state";
import { WORKSHOP_TO_IDS } from "./mapping";
import { PresentationRegion } from "./region";
import { RegionLoading } from "./region-loading";
import {
  ConfidenceMeter,
  PresentationMetric,
  Trend,
} from "./signal";
import { StateBlock } from "./state-block";
import { StatusIndicator } from "./status";
import { PresentationSurface } from "./surface";
import {
  BodyCopy,
  Display,
  GroupTitle,
  MetaCopy,
  NumericCopy,
  PageTitle,
} from "./typography";

export function FoundationGalleryScreen() {
  return (
    <EngineeringFrame
      page="Gallery"
      title="Foundation Gallery"
      description="Sprint 0 presentation wrappers on VentureOS IDS. No workshop host, no fixture intelligence, no EIR."
      meta="Presentation review"
    >
      <Stack gap="section">
        <PresentationRegion
          title="Typography"
          note="Type roles consume existing ids-* utilities."
        >
          <Display>VentureOS</Display>
          <PageTitle>Foundation presentation</PageTitle>
          <GroupTitle>Operational density</GroupTitle>
          <BodyCopy>
            Type roles consume existing ids-* utilities. Fonts bind through IDS
            variables, not Google Fonts or workshop CSS.
          </BodyCopy>
          <MetaCopy>Executive Light and Executive Dark share this scale.</MetaCopy>
          <NumericCopy>1280</NumericCopy>
        </PresentationRegion>

        <PresentationRegion title="Surfaces">
          <Grid variant="executive">
            <PresentationSurface level="primary">
              <GroupTitle>Primary</GroupTitle>
              <MetaCopy>ids-surface-card</MetaCopy>
            </PresentationSurface>
            <PresentationSurface level="elevated">
              <GroupTitle>Elevated</GroupTitle>
              <MetaCopy>ids-surface-elevated</MetaCopy>
            </PresentationSurface>
            <PresentationSurface level="sunken">
              <GroupTitle>Sunken</GroupTitle>
              <MetaCopy>ids-surface</MetaCopy>
            </PresentationSurface>
            <PresentationSurface level="secondary">
              <GroupTitle>Secondary</GroupTitle>
              <MetaCopy>vos-panel</MetaCopy>
            </PresentationSurface>
          </Grid>
        </PresentationRegion>

        <PresentationRegion title="Existing primitives">
          <Grid variant="pair">
            <Card>
              <Stack gap="compact">
                <GroupTitle>@repo/ui Card</GroupTitle>
                <MetaCopy>ids-surface-card. Not shadcn.</MetaCopy>
              </Stack>
            </Card>
            <Stack gap="compact">
              <Button variant="primary">Primary action</Button>
              <Button variant="secondary">Secondary action</Button>
            </Stack>
          </Grid>
        </PresentationRegion>

        <PresentationRegion title="Status">
          <Stack gap="tight">
            <StatusIndicator level="critical" />
            <StatusIndicator level="high" />
            <StatusIndicator level="medium" />
            <StatusIndicator level="positive" />
            <StatusIndicator level="neutral" />
          </Stack>
        </PresentationRegion>

        <PresentationRegion title="Signals">
          <Grid variant="executive">
            <PresentationMetric
              label="Breakpoint"
              value="1280"
              note="IDS xl. Not a commercial figure."
            />
            <Stack gap="compact">
              <ConfidenceMeter level="high" />
              <Trend direction="flat" label="Unchanged presentation" />
            </Stack>
          </Grid>
        </PresentationRegion>

        <PresentationRegion title="Feedback">
          <EmptyCopy kicker="Empty" title="No items in this region">
            Filtered and empty states stay copy-only. No invented records.
          </EmptyCopy>
          <RegionLoading label="Region loading" />
          <StateBlock
            tone="informative"
            title="Degraded presentation"
            description="A quiet notice. No backend state machine."
          />
          <ErrorState message="The server returned a string error." />
        </PresentationRegion>

        <PresentationRegion title="Table foundation">
          <FoundationLedger />
        </PresentationRegion>

        <Desk>
          <Flow>
            <PresentationRegion title="Canvas">
              <BodyCopy>
                Inspector uses the certified sidebar.lg token. Hard-coded workshop
                inspector widths are rejected.
              </BodyCopy>
            </PresentationRegion>
          </Flow>
          <Inspector>
            <EmptyCopy kicker="Context panel" title="Reserved slot">
              Empty presentation slot. No inspector feed. No EIR.
            </EmptyCopy>
          </Inspector>
        </Desk>

        <PresentationRegion title="IDS mapping">
          <MetaCopy>
            Workshop surface-primary maps to {WORKSHOP_TO_IDS["surface-primary"]}.
            Workshop brand attribute maps to data-ids-brand + data-ids-atmosphere.
          </MetaCopy>
        </PresentationRegion>
      </Stack>
    </EngineeringFrame>
  );
}
