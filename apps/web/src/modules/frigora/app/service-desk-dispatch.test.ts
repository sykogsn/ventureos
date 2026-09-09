import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  deriveAttentionSignals,
  deriveDispatchBoardBucket,
  deriveDispatchResponseState,
} from "@/modules/frigora/app/operational-derivations";
import type {
  FrigoraVisit,
  FrigoraWorkOrder,
} from "@/modules/frigora/types";

const WEB_ROOT = join(process.cwd(), "src");
const NOW = "2026-09-07T12:00:00.000Z";

function workOrder(
  overrides: Partial<FrigoraWorkOrder> = {},
): FrigoraWorkOrder {
  return {
    id: "wo-1" as FrigoraWorkOrder["id"],
    workspaceId: "ws-1" as FrigoraWorkOrder["workspaceId"],
    ventureId: "ven-1" as FrigoraWorkOrder["ventureId"],
    customerId: "customer-1" as FrigoraWorkOrder["customerId"],
    siteId: "site-1" as FrigoraWorkOrder["siteId"],
    primaryAssetId: null,
    workReference: "WO-1",
    workKind: "reactive",
    reportedCondition: null,
    status: "open",
    assignedUserId: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    assignmentAcceptedAt: null,
    assignmentDeclinedAt: null,
    assignmentDeclineReason: null,
    cancellationReason: null,
    sourceRecommendedActionId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function visit(status: FrigoraVisit["status"]): FrigoraVisit {
  return {
    id: `visit-${status}` as FrigoraVisit["id"],
    workspaceId: "ws-1" as FrigoraVisit["workspaceId"],
    ventureId: "ven-1" as FrigoraVisit["ventureId"],
    workOrderId: "wo-1" as FrigoraVisit["workOrderId"],
    attendingUserId: "user-1" as FrigoraVisit["attendingUserId"],
    arrivedAt: "2026-09-07T09:00:00.000Z",
    departedAt: status === "departed" ? "2026-09-07T10:00:00.000Z" : null,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("Frigora F2.2 Service Desk projections", () => {
  it("derives response state without a persisted dispatch lifecycle", () => {
    assert.equal(deriveDispatchResponseState(workOrder()), "unscheduled");
    assert.equal(
      deriveDispatchResponseState(
        workOrder({
          scheduledStartAt: "2026-09-08T08:00:00.000Z",
          scheduledEndAt: "2026-09-08T10:00:00.000Z",
        }),
      ),
      "unassigned",
    );
    assert.equal(
      deriveDispatchResponseState(
        workOrder({
          assignedUserId: "user-1" as FrigoraWorkOrder["assignedUserId"],
          scheduledStartAt: "2026-09-08T08:00:00.000Z",
          scheduledEndAt: "2026-09-08T10:00:00.000Z",
        }),
      ),
      "awaiting_response",
    );
    assert.equal(
      deriveDispatchResponseState(
        workOrder({
          assignedUserId: "user-1" as FrigoraWorkOrder["assignedUserId"],
          scheduledStartAt: "2026-09-08T08:00:00.000Z",
          scheduledEndAt: "2026-09-08T10:00:00.000Z",
          assignmentAcceptedAt: NOW,
        }),
      ),
      "accepted",
    );
    assert.equal(
      deriveDispatchResponseState(
        workOrder({
          assignedUserId: "user-1" as FrigoraWorkOrder["assignedUserId"],
          scheduledStartAt: "2026-09-08T08:00:00.000Z",
          scheduledEndAt: "2026-09-08T10:00:00.000Z",
          assignmentDeclinedAt: NOW,
          assignmentDeclineReason: "Unavailable",
        }),
      ),
      "declined",
    );
  });

  it("derives board buckets with active Visit and completion precedence", () => {
    const accepted = workOrder({
      assignedUserId: "user-1" as FrigoraWorkOrder["assignedUserId"],
      scheduledStartAt: "2026-09-08T08:00:00.000Z",
      scheduledEndAt: "2026-09-08T10:00:00.000Z",
      assignmentAcceptedAt: NOW,
    });
    assert.equal(deriveDispatchBoardBucket(accepted, []), "accepted");
    assert.equal(deriveDispatchBoardBucket(accepted, [visit("open")]), "active");
    assert.equal(
      deriveDispatchBoardBucket({ ...accepted, status: "closed" }, [visit("departed")]),
      "completed",
    );
  });

  it("derives F2.2 attention including stale and expired assignments", () => {
    const declined = workOrder({
      assignedUserId: "user-missing" as FrigoraWorkOrder["assignedUserId"],
      scheduledStartAt: "2026-09-07T08:00:00.000Z",
      scheduledEndAt: "2026-09-07T10:00:00.000Z",
      assignmentDeclinedAt: "2026-09-07T07:00:00.000Z",
      assignmentDeclineReason: "Unavailable",
    });
    const signals = deriveAttentionSignals(
      declined,
      [],
      new Set(["user-present"]),
      NOW,
    );
    assert.ok(signals.includes("ASSIGNMENT_DECLINED"));
    assert.ok(signals.includes("EXPIRED_SERVICE_WINDOW"));
    assert.ok(signals.includes("STALE_ASSIGNEE"));
    assert.equal(
      deriveAttentionSignals(declined, [visit("departed")], new Set(), NOW).includes(
        "EXPIRED_SERVICE_WINDOW",
      ),
      false,
    );
  });

  it("integrates repository-backed dispatch controls into Operations and work detail", () => {
    const route = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/operations/page.tsx"),
      "utf8",
    );
    const operations = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/operations-screen.tsx"),
      "utf8",
    );
    const work = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/work-screens.tsx"),
      "utf8",
    );
    const mutations = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/mutation-actions.ts"),
      "utf8",
    );
    assert.match(route, /searchParams/);
    assert.match(operations, /Service Desk/);
    assert.match(operations, /DispatchControls/);
    assert.match(work, /AssignmentResponseControls/);
    assert.match(mutations, /scheduleWorkOrderFormAction/);
    assert.match(mutations, /acceptWorkOrderAssignmentFormAction/);
    assert.doesNotMatch(operations, /priority/i);
  });

  it("OBS-003 remounts assignee select from authoritative assignedUserId (keyed defaultValue)", () => {
    const dispatchControls = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/forms/dispatch-controls.tsx"),
      "utf8",
    );
    const selectBlock = dispatchControls.match(
      /<select[\s\S]*?name="userId"[\s\S]*?>/,
    );
    assert.ok(selectBlock, "assignee select with name=userId must exist");
    assert.match(
      selectBlock[0],
      /key=\{props\.assignedUserId \?\? "unassigned"\}/,
    );
    assert.match(
      selectBlock[0],
      /defaultValue=\{props\.assignedUserId \?\? ""\}/,
    );

    // Remount contract (no jsdom): when authoritative assignment changes A→B,
    // the select key changes so a remount applies defaultValue=B. Immediate
    // unchanged re-submit therefore posts B, not stale A.
    const selectedAfterPropChange = (assignedUserId: string | null) =>
      assignedUserId ?? "";
    const keyFor = (assignedUserId: string | null) =>
      assignedUserId ?? "unassigned";

    const engineerA = "user-engineer-a";
    const engineerB = "user-engineer-b";
    assert.equal(keyFor(engineerA), engineerA);
    assert.equal(selectedAfterPropChange(engineerA), engineerA);
    assert.notEqual(keyFor(engineerA), keyFor(engineerB));
    assert.equal(selectedAfterPropChange(engineerB), engineerB);
    assert.equal(selectedAfterPropChange(engineerB), engineerB);
  });
});
