import { ExecutiveStack } from "@/core/layout";

export function VentureMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <span className="ids-kicker">VentureOS</span>;
  }

  return (
    <ExecutiveStack gap="tight">
      <p className="ids-kicker">VentureOS</p>
      <p className="ids-label">Operating system</p>
    </ExecutiveStack>
  );
}
