import { Pulse, Stack } from "@/core/layout";

export function RegionLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <Stack gap="compact">
        <p className="ids-kicker">{label}</p>
        <Pulse height="3" width="third" />
        <Pulse height="5" width="majority" />
        <Pulse width="wide" />
        <span className="sr-only">{label}</span>
      </Stack>
    </div>
  );
}
