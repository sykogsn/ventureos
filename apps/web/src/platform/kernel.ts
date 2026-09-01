import type { DocumentPort, EventBus, NotificationPort, PermissionService, StoredObjectPort, WorkflowEngine } from "@/contracts";
import { createKnowledgeGraph, createReasoner, type KnowledgeGraph, type Reasoner } from "@/knowledge";
import { createAuditLog, type AuditLog } from "@/platform/audit/log";
import { createDocumentPort } from "@/platform/documents/port";
import { createEventBus } from "@/platform/events/bus";
import { createJobOrchestrator, type JobOrchestrator } from "@/platform/jobs/orchestrator";
import { createNotificationPort } from "@/platform/notifications/port";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { createLocalBlobStorageAdapter } from "@/platform/storage/local-adapter";
import { createStoredObjectPort } from "@/platform/storage/port";
import { createScheduler, type Scheduler } from "@/platform/scheduler/scheduler";
import { createTelemetry, type Telemetry } from "@/platform/telemetry/telemetry";
import { createWorkflowEngine } from "@/platform/workflows/engine";
import { WORKFORCE_RUN_STEP_JOB } from "@/core/workforce/run";

export type Platform = {
  events: EventBus;
  scheduler: Scheduler;
  workflows: WorkflowEngine;
  permissions: PermissionService;
  audit: AuditLog;
  telemetry: Telemetry;
  jobs: JobOrchestrator;
  notifications: NotificationPort;
  documents: DocumentPort;
  storedObjects: StoredObjectPort;
  knowledge: KnowledgeGraph;
  reasoner: Reasoner;
};

const globalStore = globalThis as typeof globalThis & {
  __vosPlatform?: Platform;
};

export function createPlatform(): Platform {
  const events = createEventBus();
  const knowledge = createKnowledgeGraph();
  const jobs = createJobOrchestrator();
  const scheduler = createScheduler();
  const telemetry = createTelemetry();
  const audit = createAuditLog();

  events.subscribe("*", (event) => {
    telemetry.counter("events.published", 1, { type: event.type });
    void audit.record({
      action: `event.${event.type}`,
      actor: event.actorId ? { userId: event.actorId } : undefined,
      metadata: {
        workspaceId: event.workspaceId ?? "",
        ventureId: event.ventureId ?? "",
      },
    });
  });

  jobs.register("noop", async () => undefined);
  jobs.register(WORKFORCE_RUN_STEP_JOB, async (job) => {
    const { getWorkforceService } = await import("@/modules/workforce/service");
    await getWorkforceService().orchestrator.handleJob(job);
  });
  scheduler.every("jobs.processDue", 15_000, () => {
    void (async () => {
      await jobs.processDue();
      const { getWorkforceService } = await import("@/modules/workforce/service");
      await getWorkforceService().orchestrator.recover();
    })();
  });

  const permissions = createPermissionService(createDbMembershipStore());
  const storedObjectAdapter = createLocalBlobStorageAdapter();

  return {
    events,
    scheduler,
    workflows: createWorkflowEngine(),
    permissions,
    audit,
    telemetry,
    jobs,
    notifications: createNotificationPort(),
    documents: createDocumentPort(),
    storedObjects: createStoredObjectPort({
      adapter: storedObjectAdapter,
      audit,
      permissions,
    }),
    knowledge,
    reasoner: createReasoner(knowledge),
  };
}

export function getPlatform() {
  if (!globalStore.__vosPlatform) {
    globalStore.__vosPlatform = createPlatform();
  }

  return globalStore.__vosPlatform;
}
