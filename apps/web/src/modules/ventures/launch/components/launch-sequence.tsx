import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { launchArtefactCatalog } from "../types";

export function LaunchSequence({
  activeIndex,
  complete,
}: {
  activeIndex: number;
  complete: boolean;
}) {
  return (
    <div className="fixed inset-0 z-dialog flex items-center justify-center ids-overlay px-4">
      <div className="ids-surface-modal w-full max-w-md p-6">
        <p className="ids-kicker">Launch sequence</p>
        <h2 className="ids-lead mt-2">
          {complete ? "Company HQ is ready" : "Founding the company"}
        </h2>
        <ul className="mt-5 flex flex-col gap-2">
          {launchArtefactCatalog.map((artefact, index) => {
            const done = complete || index < activeIndex;
            const current = !complete && index === activeIndex;

            return (
              <li
                key={artefact.id}
                className={cn(
                  "ids-label ids-transition flex items-center justify-between px-3 py-2",
                  done
                    ? "ids-surface-elevated"
                    : current
                      ? "ids-surface-card ids-surface-selected"
                      : "text-muted",
                )}
              >
                <span>{artefact.label}</span>
                {done ? <Check className="ids-icon-sm" aria-hidden="true" /> : null}
                {current ? <span className="ids-kicker">Creating</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
