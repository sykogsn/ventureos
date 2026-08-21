import type { ReactNode } from "react";
import { VentureMark } from "@/core/shell/venture-mark";
import {
  ExecutiveBanner,
  ExecutiveFrame,
  ExecutiveMain,
  ExecutiveMeasure,
  ExecutiveRail,
  ExecutiveSplit,
  ExecutiveStack,
  ExecutiveStage,
} from "@/core/layout";

export function ExecutiveAuthShell({ children }: { children: ReactNode }) {
  return (
    <ExecutiveFrame>
      <ExecutiveSplit>
        <ExecutiveRail>
          <VentureMark />
          <ExecutiveStack gap="form">
            <p className="ids-display">The operating system for companies.</p>
            <p className="ids-lead">Found, operate, and decide from one desk.</p>
            <p className="ids-body text-muted">
              Situation Room, Company HQ, and the Executive Office share one OS.
            </p>
          </ExecutiveStack>
          <p className="ids-caption">Foundation v1.1</p>
        </ExecutiveRail>

        <ExecutiveStage>
          <ExecutiveBanner>
            <VentureMark compact />
          </ExecutiveBanner>
          <ExecutiveMain>
            <ExecutiveMeasure>{children}</ExecutiveMeasure>
          </ExecutiveMain>
        </ExecutiveStage>
      </ExecutiveSplit>
    </ExecutiveFrame>
  );
}
