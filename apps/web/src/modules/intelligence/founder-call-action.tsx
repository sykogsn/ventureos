"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { recordFounderDecisionAction } from "@/modules/intelligence/actions";
import { cn } from "@/utils/cn";
import { Stack } from "@/core/layout";

const actionClassName =
  "ids-label ids-transition text-foreground underline-offset-4 hover:underline";

export function FounderCallAction({
  decisionId,
  ventureId,
  ruling,
  href,
  children,
}: {
  decisionId?: string;
  ventureId?: string;
  ruling?: string;
  href: string;
  children: ReactNode;
}) {
  if (!decisionId || !ventureId || !ruling) {
    return (
      <Link href={href} className={actionClassName}>
        {children}
      </Link>
    );
  }

  return (
    <RecordFounderCall
      decisionId={decisionId}
      ventureId={ventureId}
      ruling={ruling}
    >
      {children}
    </RecordFounderCall>
  );
}

function RecordFounderCall({
  decisionId,
  ventureId,
  ruling,
  children,
}: {
  decisionId: string;
  ventureId: string;
  ruling: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setPending(true);
    setError(null);
    const result = await recordFounderDecisionAction({
      decisionId,
      ventureId,
      ruling,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Stack gap="tight">
      <button
        type="button"
        onClick={() => void record()}
        disabled={pending}
        className={cn(actionClassName, "disabled:opacity-60")}
      >
        {children}
      </button>
      {error ? <p className="ids-caption">{error}</p> : null}
    </Stack>
  );
}
