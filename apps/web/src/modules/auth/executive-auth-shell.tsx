import type { ReactNode } from "react";
import { VentureMark } from "@/core/shell/venture-mark";
import { ThemeToggle } from "@/core/shell/theme-toggle";
import {
  Cluster,
  ExecutiveFrame,
  ExecutiveMeasure,
  ExecutiveStack,
  ExecutiveStage,
  Main,
} from "@/core/layout";

export function ExecutiveAuthShell({ children }: { children: ReactNode }) {
  return (
    <ExecutiveFrame>
      <ExecutiveStage>
        <Main align="start">
          <ExecutiveMeasure>
            <ExecutiveStack gap="section">
              <Cluster justify="between" wrap={false}>
                <VentureMark compact />
                <ThemeToggle />
              </Cluster>
              {children}
            </ExecutiveStack>
          </ExecutiveMeasure>
        </Main>
      </ExecutiveStage>
    </ExecutiveFrame>
  );
}
