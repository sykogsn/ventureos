import { FRIGORA_FIELD_WORKFLOW_LABEL, FRIGORA_FIELD_WORKFLOW_STEPS } from "@/modules/frigora/app/field-workflow";

export function FieldWorkflowNav() {
  return (
    <nav
      aria-label={FRIGORA_FIELD_WORKFLOW_LABEL}
      className="sticky top-0 z-[var(--ids-foundation-z-topbar)] -mx-1 flex gap-1 overflow-x-auto bg-[var(--workspace)] py-2"
    >
      {FRIGORA_FIELD_WORKFLOW_STEPS.map((step) => (
        <a
          key={step.id}
          href={`#${step.id}`}
          className="ids-caption inline-flex min-h-[var(--ids-foundation-control-height-lg)] shrink-0 items-center rounded-[var(--ids-foundation-radius-control)] border border-[var(--ids-foundation-stroke-subtle)] px-[var(--ids-foundation-space-3)] py-[var(--ids-foundation-space-2)] text-foreground"
        >
          {step.label}
        </a>
      ))}
    </nav>
  );
}
