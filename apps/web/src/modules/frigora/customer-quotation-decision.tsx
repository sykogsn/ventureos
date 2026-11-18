"use client";

import { useEffect, useState } from "react";
import type { CustomerQuotationReview, CustomerQuotationSubmission } from "./quotation-decision-contract";
import {
  browserDecisionFragmentStore,
  createStartupFlight,
  decisionPagePath,
  rememberDecisionFragment,
  retainDecisionFragment,
} from "./quotation-decision-fragment";
import { QuotationDecisionView } from "./quotation-decision-view";

type Screen =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "limited" }
  | { kind: "stale" }
  | { kind: "used"; decision: "approved" | "declined"; version: number }
  | { kind: "ready"; review: Extract<CustomerQuotationReview, { state: "ready" }>; pending: "approved" | "declined" | null; selectedOptionalIds: string[] }
  | { kind: "submitting"; review: Extract<CustomerQuotationReview, { state: "ready" }> }
  | { kind: "done"; decision: "approved" | "declined"; version: number }
  | { kind: "uncertain" };

if (typeof window !== "undefined") {
  rememberDecisionFragment(window.location, browserDecisionFragmentStore());
}

const reviewFlight = createStartupFlight();

async function postDecision(body: Record<string, unknown>) {
  const response = await fetch("/api/quotation-decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  return response.json() as Promise<CustomerQuotationReview | CustomerQuotationSubmission | { state: "unavailable" }>;
}

function statusCopy(screen: Screen) {
  if (screen.kind === "loading") return "Checking this decision link.";
  if (screen.kind === "invalid") return "This decision link is not valid.";
  if (screen.kind === "expired") return "This decision link has expired.";
  if (screen.kind === "revoked") return "This decision link has been revoked.";
  if (screen.kind === "limited") return "Too many attempts. Wait and open the link again.";
  if (screen.kind === "stale") return "This quotation changed after the link was sent. Ask the office for a new link.";
  if (screen.kind === "used") {
    return `Version ${screen.version} was already ${screen.decision}.`;
  }
  if (screen.kind === "done") {
    return `Version ${screen.version} is ${screen.decision}.`;
  }
  if (screen.kind === "uncertain") {
    return "The connection failed before the result could be confirmed. Check the link again before trying a second time. A saved decision will not be recorded twice.";
  }
  return "";
}

export function CustomerQuotationDecision({ grantId }: { grantId: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  if (typeof window !== "undefined") {
    retainDecisionFragment(grantId, window.location.hash, browserDecisionFragmentStore());
  }

  useEffect(() => {
    const retained = retainDecisionFragment(grantId, window.location.hash, browserDecisionFragmentStore());
    const nextUrl = decisionPagePath(window.location.pathname, window.location.search);
    window.history.replaceState(null, "", nextUrl);
    setSecret((current) => {
      if (retained) return current === retained ? current : retained;
      return current == null ? "" : current;
    });
  }, [grantId]);

  useEffect(() => {
    if (secret == null) return;
    if (!secret) {
      setScreen({ kind: "invalid" });
      return;
    }
    let cancelled = false;
    void reviewFlight(`${grantId}:${attempt}`, () => postDecision({ action: "review", grantId, secret }))
      .then((result) => {
        if (cancelled) return;
        setScreen(screenFromReview(result));
      })
      .catch(() => {
        if (!cancelled) setScreen({ kind: "uncertain" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, grantId, secret]);

  async function submit(decision: "approved" | "declined") {
    if (!secret || screen.kind !== "ready") return;
    const review = screen.review;
    const selectedOptionalIds = screen.selectedOptionalIds;
    setScreen({ kind: "submitting", review });
    try {
      const result = await postDecision({
        action: "submit",
        grantId,
        secret,
        decision,
        selectedOptionalLineIds: decision === "approved" ? selectedOptionalIds : [],
      });
      setScreen(screenFromSubmission(result, review));
    } catch {
      setScreen({ kind: "uncertain" });
    }
  }

  const message = statusCopy(screen);
  return (
    <main className="mx-auto grid min-h-full w-full max-w-lg gap-6 px-4 py-8 sm:py-12">
      <p className="text-sm font-medium text-text-muted">Quotation decision</p>
      {screen.kind === "loading" || screen.kind === "submitting" ? (
        <p role="status" className="text-text-secondary">{screen.kind === "loading" ? "Loading quotation…" : "Saving your decision…"}</p>
      ) : null}
      {message && screen.kind !== "loading" && screen.kind !== "submitting" && screen.kind !== "ready" ? (
        <p role="status" className="text-lg text-text-primary">{message}</p>
      ) : null}
      {screen.kind === "uncertain" ? (
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-4 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => {
            setScreen({ kind: "loading" });
            setAttempt((current) => current + 1);
          }}
        >
          Check this link again
        </button>
      ) : null}
      {screen.kind === "ready" ? (
        <>
          <QuotationDecisionView
            review={screen.review}
            selectedOptionalIds={screen.selectedOptionalIds}
            onToggleOptional={(lineId) => {
              if (screen.kind !== "ready") return;
              const selectedOptionalIds = screen.selectedOptionalIds.includes(lineId)
                ? screen.selectedOptionalIds.filter((id) => id !== lineId)
                : [...screen.selectedOptionalIds, lineId];
              setScreen({ ...screen, selectedOptionalIds, pending: null });
            }}
          />
          {screen.pending == null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-11 rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setScreen({ kind: "ready", review: screen.review, pending: "approved", selectedOptionalIds: screen.selectedOptionalIds })}
              >
                Approve
              </button>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-4 py-2 font-medium text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setScreen({ kind: "ready", review: screen.review, pending: "declined", selectedOptionalIds: screen.selectedOptionalIds })}
              >
                Decline
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-text-secondary">
                Confirm that you want to {screen.pending === "approved" ? "approve" : "decline"} version {screen.review.version}.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={() => {
                    if (screen.pending) void submit(screen.pending);
                  }}
                >
                  {screen.pending === "approved" ? "Confirm approval" : "Confirm decline"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-border px-4 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={() => setScreen({ kind: "ready", review: screen.review, pending: null, selectedOptionalIds: screen.selectedOptionalIds })}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

function screenFromReview(result: { state: string; decision?: string; version?: number; description?: string }): Screen {
  if (result.state === "ready" && result.description && typeof result.version === "number") {
    return {
      kind: "ready",
      pending: null,
      selectedOptionalIds: [],
      review: result as Extract<CustomerQuotationReview, { state: "ready" }>,
    };
  }
  if (result.state === "expired") return { kind: "expired" };
  if (result.state === "revoked") return { kind: "revoked" };
  if (result.state === "limited") return { kind: "limited" };
  if (result.state === "stale") return { kind: "stale" };
  if (result.state === "used" && (result.decision === "approved" || result.decision === "declined") && typeof result.version === "number") {
    return { kind: "used", decision: result.decision, version: result.version };
  }
  if (result.state === "unavailable") return { kind: "uncertain" };
  return { kind: "invalid" };
}

function screenFromSubmission(
  result: { state: string; decision?: string; version?: number },
  review: Extract<CustomerQuotationReview, { state: "ready" }>,
): Screen {
  if ((result.state === "approved" || result.state === "declined") && typeof result.version === "number") {
    return { kind: "done", decision: result.state, version: result.version };
  }
  return screenFromReview({ ...result, description: result.state === "ready" ? review.description : undefined });
}
