import { InsetSurface, Stack } from "@/core/layout";

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert">
      <InsetSurface>
        <Stack gap="compact">
          <p className="ids-kicker">Error</p>
          <p className="ids-chip ids-status-risk">String contract only</p>
          <p className="ids-body text-foreground">{message}</p>
        </Stack>
      </InsetSurface>
    </div>
  );
}
