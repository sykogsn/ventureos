export const FRIGORA_FIELD_WORKFLOW_STEPS = [
  { id: "field-job", label: "Job" },
  { id: "field-check", label: "Check" },
  { id: "field-diagnose", label: "Diagnose" },
  { id: "field-repair", label: "Repair" },
  { id: "field-prove", label: "Prove" },
  { id: "field-finish", label: "Finish" },
] as const;

export const FRIGORA_FIELD_WORKFLOW_LABEL = "Job → Check → Diagnose → Repair → Prove → Finish";
