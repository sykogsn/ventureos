import {
  Grid,
  HeaderRule,
  Pulse,
  ReadingRegion,
  Stack,
  SurfaceBody,
  WorkspaceCanvas,
} from "@/core/layout";

export function ExecutiveLoading({ message }: { message: string }) {
  return (
    <WorkspaceCanvas>
      <div role="status" aria-live="polite" aria-busy="true">
        <Stack gap="section">
          <HeaderRule>
            <Stack gap="compact">
              <Pulse height="3" width="majority" />
              <p className="ids-kicker">VentureOS</p>
              <p className="ids-label">{message}</p>
              <ReadingRegion size="sm">
                <Pulse height="8" width="majority" />
              </ReadingRegion>
              <ReadingRegion size="lg">
                <Pulse />
              </ReadingRegion>
              <ReadingRegion size="md">
                <Pulse width="wide" />
              </ReadingRegion>
            </Stack>
          </HeaderRule>
          <div className="vos-panel">
            <SurfaceBody>
              <Stack gap="compact">
                <Pulse height="3" width="third" />
                <Pulse height="5" width="majority" />
                <Pulse />
                <Pulse width="wide" />
              </Stack>
            </SurfaceBody>
          </div>
          <Grid variant="executive">
            <div className="vos-panel">
              <SurfaceBody>
                <Stack gap="compact">
                  <Pulse height="3" width="third" />
                  <Pulse />
                  <Pulse width="majority" />
                </Stack>
              </SurfaceBody>
            </div>
            <div className="vos-panel">
              <SurfaceBody>
                <Stack gap="compact">
                  <Pulse height="3" width="third" />
                  <Pulse />
                  <Pulse width="half" />
                </Stack>
              </SurfaceBody>
            </div>
          </Grid>
          <span className="sr-only">{message}</span>
        </Stack>
      </div>
    </WorkspaceCanvas>
  );
}
