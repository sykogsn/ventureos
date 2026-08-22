import { Check } from "lucide-react";
import { launchArtefactCatalog } from "../types";
import {
  Cluster,
  ModalMeasure,
  ModalStage,
  Stack,
  SurfaceBody,
} from "@/core/layout";

export function LaunchSequence({
  activeIndex,
  complete,
}: {
  activeIndex: number;
  complete: boolean;
}) {
  return (
    <ModalStage>
      <ModalMeasure>
        <SurfaceBody>
          <Stack gap="compact">
            <p className="ids-kicker">Launch sequence</p>
            <h2 className="ids-lead">
              {complete ? "Company HQ is ready" : "Founding the company"}
            </h2>
            <Stack gap="tight">
              {launchArtefactCatalog.map((artefact, index) => {
                const done = complete || index < activeIndex;
                const current = !complete && index === activeIndex;
                const surface = done
                  ? "ids-label ids-transition ids-surface-elevated"
                  : current
                    ? "ids-label ids-transition ids-surface-card ids-surface-selected"
                    : "ids-label ids-transition text-muted";

                return (
                  <div key={artefact.id} className={surface}>
                    <Cluster justify="between">
                      <span>{artefact.label}</span>
                      {done ? <Check className="ids-icon-sm" aria-hidden="true" /> : null}
                      {current ? <span className="ids-kicker">Creating</span> : null}
                    </Cluster>
                  </div>
                );
              })}
            </Stack>
          </Stack>
        </SurfaceBody>
      </ModalMeasure>
    </ModalStage>
  );
}
