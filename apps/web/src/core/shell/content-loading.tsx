import { Pulse, Stack } from "@/core/layout";

export function ContentLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <Stack gap="compact">
        <Pulse height="3" width="third" />
        <span className="sr-only">{label}</span>
      </Stack>
    </div>
  );
}
