import type { Metadata } from "next";
import Link from "next/link";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { VentureMark } from "@/core/shell/venture-mark";
import { Fit, Main, ReadingRegion, Stack, Workspace } from "@/core/layout";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <Workspace>
      <Main align="center">
        <ReadingRegion size="md">
          <div className="vos-screen">
            <Stack gap="section">
              <VentureMark />
              <EmptyCopy title="This desk is not here">
                The page you asked for is not part of this workspace.
              </EmptyCopy>
              <Fit>
                <Link href="/dashboard" className="vos-btn-primary">
                  Return to the Situation Room
                </Link>
              </Fit>
            </Stack>
          </div>
        </ReadingRegion>
      </Main>
    </Workspace>
  );
}
