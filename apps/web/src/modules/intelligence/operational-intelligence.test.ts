import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT } from "jose";
import type {
  ClaimKnowledgeObject,
  LearningKnowledgeObject,
  EvidenceKnowledgeObject,
  KnowledgeObjectKernel,
} from "@repo/brain";
import type { UserId, WorkspaceId } from "@/contracts";
import { getPlatform } from "@/platform/kernel";
import { authSecretKey } from "@/lib/auth/session-token";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories/sqlite";
import {
  captureIntelligence,
  amendIntelligence,
  retractIntelligence,
  supersedeIntelligence,
  getIntelligence,
  queryIntelligence,
  traceIntelligence,
} from "./operational-intelligence";

const AT = "2026-09-01T12:00:00.000Z";
const REVIEW = "2026-09-02T12:00:00.000Z";
const ws = "workspace-a" as WorkspaceId,
  other = "workspace-b" as WorkspaceId;
function kernel(id: string): Omit<KnowledgeObjectKernel, "type"> {
  return {
    id,
    title: id,
    summary: "Test observation",
    purpose: "Test durable intelligence",
    why: "Evidence before automation",
    evidence: [],
    relationships: [],
    history: [{ at: AT, note: "Initial record" }],
    owner: "Founder",
    status: "Specified",
    reviewDate: "2026-09-02",
    lastReview: "2026-09-01",
    version: "1",
    aiContext: "Structural test fixture",
    scopes: ["Qualora"],
    plane: "operating",
    operatingScope: {
      workspaceId: ws,
      originatingVentureId: "venture-a",
      applicability: [{ workspaceId: ws, ventureId: "venture-a" }],
      sharing: { recipients: [] },
    },
  };
}
function claim(id = "claim"): ClaimKnowledgeObject {
  return {
    ...kernel(id),
    type: "Claim",
    operatingScope: kernel(id).operatingScope!,
    statement: "A hypothesis pending evidence",
    classification: "HYPOTHESIS",
    evidenceIds: [],
    sourceRefs: [],
    assumptions: [],
    effectiveFrom: AT,
    recordedAt: AT,
    validity: "ACTIVE",
  };
}
function evidence(id = "evidence"): EvidenceKnowledgeObject {
  return {
    ...kernel(id),
    type: "Evidence",
    source: "Inspection ledger",
    capturedAt: AT,
    supportsObjectId: "claim",
    weightClass: "Primary",
    provenance: {
      source: { system: "inspection", recordId: id, version: "1" },
      observedAt: AT,
      method: "Inspection",
      origin: "OBSERVED",
    },
    outcomeObservation: {
      executionRef: { system: "execution", recordId: id, version: "1" },
      metric: "count",
      expectedValue: 1,
      observedValue: 1,
      observedAt: AT,
      window: { from: AT, to: AT },
      assessment: "MET",
    },
  };
}
function learning(): LearningKnowledgeObject {
  return {
    ...kernel("learning"),
    type: "Learning",
    operatingScope: kernel("learning").operatingScope!,
    sourceEvidenceIds: ["evidence"],
    sourceEventRefs: [],
    expectedResult: "One",
    actualResult: "One",
    deviation: "None",
    rootCause: {
      statement: "Possible cause",
      classification: "HYPOTHESIS",
      evidenceIds: ["evidence"],
    },
    lesson: "Investigate",
    confidence: {
      value: 0.4,
      method: "Observation",
      evidenceIds: ["evidence"],
    },
    proposedChange: "Repeat",
    recordedAt: AT,
    maturity: "OBSERVATION",
    maturityHistory: [],
    validationHistory: [],
    validity: "ACTIVE",
  };
}
describe("AIF-02 operational intelligence", () => {
  let directory: string, url: string, token: string;
  const store = () => getPersistence();
  const access = () => ({ sessionToken: token, workspaceId: ws });
  const version = async () =>
    (await store().intelligence.loadCatalogue(ws)).version;
  const command = async () => ({
    ...access(),
    expectedCatalogueVersion: await version(),
    reason: "Named operator review",
  });
  const capture = async (
    record: Parameters<typeof captureIntelligence>[0]["record"],
  ) => captureIntelligence({ ...(await command()), record });
  const amend = async (
    record: Parameters<typeof amendIntelligence>[0]["record"],
  ) =>
    amendIntelligence({
      ...(await command()),
      objectId: record.id,
      expectedObjectRevision: (await store().intelligence.findCurrent(
        ws,
        record.id,
      ))!.currentRevision,
      record,
    });
  const rejectUnchanged = async (
    run: () => Promise<unknown>,
    pattern?: RegExp,
  ) => {
    const before = await store().intelligence.loadCatalogue(ws);
    if (pattern) await assert.rejects(run, pattern);
    else await assert.rejects(run);
    assert.deepEqual(await store().intelligence.loadCatalogue(ws), before);
  };
  const seedLearning = async () => {
    await capture(claim());
    await capture(evidence());
    const l = learning();
    await capture(l);
    return l;
  };
  const supportedHistory = async () => {
    const l = await seedLearning();
    await capture(evidence("independent"));
    l.validationHistory = [
      {
        id: "v1",
        at: REVIEW,
        actor: "reviewer",
        context: "one",
        evidenceIds: ["evidence"],
        result: "SUPPORTED",
      },
      {
        id: "v2",
        at: REVIEW,
        actor: "reviewer",
        context: "two",
        evidenceIds: ["independent"],
        result: "SUPPORTED",
      },
    ];
    l.maturityHistory = [
      {
        from: "OBSERVATION",
        to: "HYPOTHESIS",
        at: REVIEW,
        actor: "reviewer",
        reason: "Evaluate",
        validationIds: ["v1", "v2"],
      },
      {
        from: "HYPOTHESIS",
        to: "REPEATED_PATTERN",
        at: REVIEW,
        actor: "reviewer",
        reason: "Repeat",
        validationIds: ["v1", "v2"],
      },
    ];
    l.maturity = "REPEATED_PATTERN";
    await amend(l);
    return l;
  };
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "vos-aif-service-"));
    url = "file:" + join(directory, "test.db").replaceAll("\\", "/");
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const userId = "actor" as UserId;
    await store().users.insert({
      id: userId,
      email: "actor@example.test",
      name: "Actor",
      passwordHash: "unused",
      createdAt: AT,
    });
    await store().sessions.insert({
      id: "session",
      userId,
      createdAt: AT,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    for (const workspaceId of [ws, other]) {
      await store().organisations.insert({
        id: workspaceId,
        name: workspaceId,
        slug: workspaceId,
        createdAt: AT,
      });
      await store().memberships.insert({
        userId,
        workspaceId,
        role: "owner",
        createdAt: AT,
      });
    }
    token = await new SignJWT({ name: "Actor", email: "actor@example.test" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti("session")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(authSecretKey());
  });
  after(() => getPlatform().scheduler.stopAll());
  afterEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch (error) {
      // Windows may retain native SQLite statement handles after client.close().
      // The isolated fixture can remain in OS temp storage; test failures still propagate.
      if (
        process.platform !== "win32" ||
        (error as NodeJS.ErrnoException).code !== "EPERM"
      )
        throw error;
    }
  });
  it("captures canonical objects durably with one trusted timestamp and authenticated actor", async () => {
    const before = Date.now();
    const result = await capture(claim());
    assert.equal(result.catalogueVersion, 1);
    const trace = await traceIntelligence({ ...access(), objectId: "claim" });
    assert.ok(trace);
    const revision = trace.revisions[0]!;
    assert.equal(revision.recorderActorId, "actor");
    assert.equal(revision.requiredPermission, "venture.update");
    assert.equal(revision.createdAt, result.evaluationTime);
    assert.equal(revision.evaluationTime, result.evaluationTime);
    assert.ok(Date.parse(revision.evaluationTime) >= before);
    assert.equal(
      revision.documentHash,
      createHash("sha256").update(revision.documentJson).digest("hex"),
    );
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    assert.deepEqual(
      (await getIntelligence({ ...access(), objectId: "claim" }))!.record,
      claim(),
    );
  });
  for (const mode of ["missing", "forged", "expired", "revoked"] as const) {
    it("rejects " + mode + " authentication before a write", async () => {
      if (mode === "missing") token = "";
      if (mode === "forged") token += "forged";
      if (mode === "expired")
        await getClient().execute(
          "UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'",
        );
      if (mode === "revoked") await store().sessions.deleteById("session");
      await rejectUnchanged(() => capture(claim()), /Authentication/);
    });
  }
  it("checks live write authority; member metadata and declared scope do not grant it", async () => {
    await store().memberships.setRole({
      userId: "actor" as UserId,
      workspaceId: ws,
      role: "member",
      createdAt: AT,
    });
    await rejectUnchanged(() => capture(claim()), /permission denied/);
    assert.deepEqual((await queryIntelligence(access())).objects, []);
  });
  it("checks venture.read for get, query and trace", async () => {
    await capture(claim());
    await getClient().execute(
      "DELETE FROM workspace_members WHERE workspace_id = 'workspace-a'",
    );
    for (const run of [
      () => getIntelligence({ ...access(), objectId: "claim" }),
      () => queryIntelligence(access()),
      () => traceIntelligence({ ...access(), objectId: "claim" }),
    ])
      await assert.rejects(run, /permission denied/);
  });
  it("does not expose a known object id through another workspace", async () => {
    await capture(claim());
    const foreign = { ...access(), workspaceId: other, objectId: "claim" };
    assert.equal(await getIntelligence(foreign), null);
    assert.equal(await traceIntelligence(foreign), null);
    assert.deepEqual((await queryIntelligence(foreign)).objects, []);
    await rejectUnchanged(
      async () =>
        amendIntelligence({
          ...(await command()),
          ...foreign,
          expectedCatalogueVersion: 0,
          expectedObjectRevision: 1,
          record: claim(),
        }),
      /not found/,
    );
  });
  for (const dimension of [
    "owner",
    "applicability",
    "sharing",
    "missing",
  ] as const) {
    it("rejects scope violation: " + dimension, async () => {
      const c = claim();
      if (dimension === "owner") c.operatingScope.workspaceId = other;
      if (dimension === "applicability")
        c.operatingScope.applicability = [
          { workspaceId: other, ventureId: "remote" },
        ];
      if (dimension === "sharing")
        c.operatingScope.sharing = {
          recipients: [{ workspaceId: other, ventureId: "remote" }],
          authorityRef: "declared",
        };
      if (dimension === "missing")
        delete (c as Partial<ClaimKnowledgeObject>).operatingScope;
      await rejectUnchanged(() => capture(c), /scope|workspace/i);
    });
  }
  it("preserves and validates authorityRef for within-workspace sharing", async () => {
    const c = claim();
    c.operatingScope.sharing.recipients = [
      { workspaceId: ws, ventureId: "second" },
    ];
    await rejectUnchanged(() => capture(c));
    c.operatingScope.sharing.authorityRef = "founder-sharing-ruling";
    await capture(c);
    assert.equal(
      (await getIntelligence({ ...access(), objectId: c.id }))!.record
        .operatingScope!.sharing.authorityRef,
      "founder-sharing-ruling",
    );
  });
  it("rejects row/payload originating venture corruption before filtering", async () => {
    await capture(claim());
    await getClient().execute(
      "UPDATE intelligence_objects SET originating_venture_id = 'wrong'",
    );
    await assert.rejects(
      queryIntelligence({ ...access(), objectId: "unrelated" }),
      /integrity|tenancy/,
    );
  });
  it("validates the whole candidate and rejects unresolved references without writing", async () => {
    const c = claim();
    c.relationships = [{ kind: "supports", objectId: "missing" }];
    await rejectUnchanged(() => capture(c));
  });
  it("does not accept future evaluation time supplied on a command", async () => {
    const c = claim();
    c.recordedAt = "2099-01-01T00:00:00.000Z";
    const input = {
      ...(await command()),
      record: c,
      evaluationTime: "2100-01-01T00:00:00.000Z",
    };
    await rejectUnchanged(() => captureIntelligence(input));
  });
  for (const maturity of [
    "REPEATED_PATTERN",
    "VALIDATED_ORGANISATIONAL_PRINCIPLE",
  ] as const) {
    it("refuses false " + maturity + " with absent progression", async () => {
      await capture(claim());
      await capture(evidence());
      const l = learning();
      l.maturity = maturity;
      await rejectUnchanged(() => capture(l), /history/);
    });
  }
  it("refuses unsupported validation for a promotion", async () => {
    const l = await seedLearning();
    l.validationHistory = [
      {
        id: "bad",
        at: REVIEW,
        actor: "reviewer",
        context: "one",
        evidenceIds: ["evidence"],
        result: "CHALLENGED",
      },
    ];
    l.maturityHistory = [
      {
        from: "OBSERVATION",
        to: "HYPOTHESIS",
        at: REVIEW,
        actor: "reviewer",
        reason: "Review",
        validationIds: ["bad"],
      },
    ];
    l.maturity = "HYPOTHESIS";
    await rejectUnchanged(() => amend(l), /supported/);
  });
  for (const origin of ["OBSERVED", "DERIVED"] as const) {
    it(
      "does not count copied/" +
        origin +
        " evidence as independent corroboration",
      async () => {
        const l = await seedLearning(),
          copy = evidence("copy");
        copy.provenance!.origin = origin;
        if (origin === "OBSERVED")
          copy.provenance!.source.recordId = "evidence";
        else
          copy.relationships = [{ kind: "derived_from", objectId: "evidence" }];
        await capture(copy);
        l.validationHistory = ["evidence", "copy"].map((id, i) => ({
          id: "v" + i,
          at: REVIEW,
          actor: "reviewer",
          context: id,
          evidenceIds: [id],
          result: "SUPPORTED",
        }));
        l.maturityHistory = [
          {
            from: "OBSERVATION",
            to: "HYPOTHESIS",
            at: REVIEW,
            actor: "reviewer",
            reason: "Review",
            validationIds: ["v0", "v1"],
          },
          {
            from: "HYPOTHESIS",
            to: "REPEATED_PATTERN",
            at: REVIEW,
            actor: "reviewer",
            reason: "Repeat",
            validationIds: ["v0", "v1"],
          },
        ];
        l.maturity = "REPEATED_PATTERN";
        await rejectUnchanged(() => amend(l), /independent/);
      },
    );
  }
  for (const change of [
    "remove transition",
    "rewrite actor",
    "reorder",
    "remove validation",
    "rewrite result",
  ] as const) {
    it("preserves exact Learning prefixes: " + change, async () => {
      const l = await supportedHistory();
      if (change === "remove transition") l.maturityHistory.pop();
      if (change === "rewrite actor") l.maturityHistory[0]!.actor = "rewritten";
      if (change === "reorder") l.maturityHistory.reverse();
      if (change === "remove validation") l.validationHistory.pop();
      if (change === "rewrite result")
        l.validationHistory[0]!.result = "CHALLENGED";
      await rejectUnchanged(() => amend(l), /prefix/);
    });
  }
  it("allows canonically valid append-only principle progression without upgrading record assessment", async () => {
    const l = await supportedHistory();
    l.maturityHistory.push({
      from: "REPEATED_PATTERN",
      to: "VALIDATED_ORGANISATIONAL_PRINCIPLE",
      at: REVIEW,
      actor: "reviewer",
      reason: "Independent measured outcomes",
      validationIds: ["v1", "v2"],
    });
    l.maturity = "VALIDATED_ORGANISATIONAL_PRINCIPLE";
    const result = await amend(l);
    assert.equal(result.objects[0]!.stored, true);
    assert.equal(result.objects[0]!.catalogueValidation, "CATALOGUE_VALID");
    assert.equal(result.objects[0]!.recordAssessment.maturity, "UNASSESSED");
  });
  for (const field of [
    "source",
    "capturedAt",
    "supportsObjectId",
    "provenance",
    "lineage",
  ] as const) {
    it("rejects Evidence origin rewrite: " + field, async () => {
      await capture(claim());
      await capture(evidence());
      const e = evidence("derived");
      e.provenance!.origin = "DERIVED";
      e.relationships = [{ kind: "derived_from", objectId: "evidence" }];
      await capture(e);
      if (field === "source") e.source = "new source";
      if (field === "capturedAt") e.capturedAt = REVIEW;
      if (field === "supportsObjectId") e.supportsObjectId = "new target";
      if (field === "provenance") e.provenance!.origin = "OBSERVED";
      if (field === "lineage") e.relationships = [];
      await rejectUnchanged(() => amend(e), /provenance|lineage/);
    });
  }
  for (const type of ["Claim", "Learning"] as const) {
    it(
      "retracts " + type + " without deletion and refuses reactivation",
      async () => {
        const record = type === "Claim" ? claim() : await seedLearning();
        if (type === "Claim") await capture(record);
        await retractIntelligence({
          ...(await command()),
          objectId: record.id,
          expectedObjectRevision: 1,
        });
        const trace = await traceIntelligence({
          ...access(),
          objectId: record.id,
        });
        assert.equal(trace!.revisions.length, 2);
        assert.equal(trace!.revisions[1]!.mutationKind, "RETRACT");
        await rejectUnchanged(() => amend(record), /Terminal/);
      },
    );
    it(
      "supersedes " +
        type +
        " atomically at one version and refuses reactivation",
      async () => {
        const record = type === "Claim" ? claim() : await seedLearning();
        if (type === "Claim") await capture(record);
        const successor = structuredClone(record);
        successor.id += "-successor";
        const before = await version();
        const result = await supersedeIntelligence({
          ...(await command()),
          objectId: record.id,
          expectedObjectRevision: 1,
          successor,
        });
        assert.equal(result.catalogueVersion, before + 1);
        assert.equal(result.objects.length, 2);
        assert.equal(
          (result.objects[0]!.record as ClaimKnowledgeObject).supersededById,
          successor.id,
        );
        assert.ok(
          await getIntelligence({ ...access(), objectId: successor.id }),
        );
        await rejectUnchanged(() => amend(record), /Terminal/);
      },
    );
  }
  it("does not invent Evidence/Decision retraction semantics or Decision success", async () => {
    await capture(claim());
    await capture(evidence());
    const decision = {
      ...kernel("decision"),
      type: "Decision" as const,
      impact: "Product" as const,
      alternatives: ["Wait"],
      issuedAt: AT,
    };
    await capture(decision);
    for (const objectId of ["evidence", "decision"]) {
      await rejectUnchanged(
        async () =>
          retractIntelligence({
            ...(await command()),
            objectId,
            expectedObjectRevision: 1,
          }),
        /Claim\/Learning/,
      );
    }
    assert.equal(
      (await getIntelligence({ ...access(), objectId: "decision" }))!
        .recordAssessment.outcome,
      "UNASSESSED",
    );
  });
  it("rejects stale catalogue and object revision at the service boundary", async () => {
    const stale = await command();
    await capture(claim());
    await rejectUnchanged(
      () => captureIntelligence({ ...stale, record: claim("second") }),
      /Catalogue version conflict/,
    );
    await rejectUnchanged(
      async () =>
        amendIntelligence({
          ...(await command()),
          objectId: "claim",
          expectedObjectRevision: 0,
          record: claim(),
        }),
      /Object revision conflict/,
    );
  });
  it("filters only after validating the complete stored workspace catalogue", async () => {
    await capture(claim());
    await capture(claim("second"));
    assert.equal(
      (
        await queryIntelligence({
          ...access(),
          objectType: "Claim",
          originatingVentureId: "venture-a",
          validity: "ACTIVE",
        })
      ).objects.length,
      2,
    );
    // Raw infrastructure deliberately bypasses semantic validation to model an invalid persisted catalogue.
    const invalid = claim("invalid");
    invalid.relationships = [{ objectId: "absent", kind: "supports" }];
    await store().intelligence.commitMutation({
      workspaceId: ws,
      expectedCatalogueVersion: await version(),
      recorderActorId: "actor",
      requiredPermission: "venture.update",
      reason: "Corruption probe",
      evaluationTime: new Date().toISOString(),
      write: {
        objectId: invalid.id,
        objectType: invalid.type,
        originatingVentureId: "venture-a",
        expectedObjectRevision: 0,
        mutationKind: "CREATE",
        documentJson: JSON.stringify(invalid),
      },
    });
    await assert.rejects(queryIntelligence({ ...access(), objectId: "claim" }));
  });
});
