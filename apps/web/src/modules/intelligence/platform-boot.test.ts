import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { projectExecutiveFloor, projectSituationRoom } from "../../core/venture/model";
import { getPlatform } from "../../platform/kernel";
import { ensureSchema } from "../../platform/persistence/db";
import { resetPersistenceLifecycle } from "../../platform/persistence/repositories/sqlite";
import { authenticateUser, registerUser } from "../auth/service";
import { createVenture, listVentureCatalogue } from "../ventures/service";
import { createWorkspace, listWorkspaceCatalogue } from "../workspaces/service";
import { assembleDeskBoot } from "./boot";
import { executeIntelligenceRuntime } from "./service";

describe("VC-012 platform boot", () => {
  after(() => {
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
  });

  it("logs in, selects a workspace, switches companies, and boots the selected company", async () => {
    const user = await registerUser({
      email: "vc012@ventureos.test",
      password: "desk-password",
      name: "Founder",
    });
    const session = await authenticateUser({
      email: "vc012@ventureos.test",
      password: "desk-password",
    });
    assert.equal(session.id, user.id);

    const deskOne = await createWorkspace({ userId: user.id, name: "Desk One" });
    const deskTwo = await createWorkspace({
      userId: user.id,
      name: "Desk Two",
      scopeWorkspaceId: deskOne.id,
    });
    assert.ok(deskOne.id);
    assert.ok(deskTwo.id);

    const north = await createVenture({
      userId: user.id,
      workspaceId: deskOne.id,
      name: "North Star",
    });
    const south = await createVenture({
      userId: user.id,
      workspaceId: deskOne.id,
      name: "South Star",
    });
    const west = await createVenture({
      userId: user.id,
      workspaceId: deskTwo.id,
      name: "West Star",
    });

    const workspaces = await listWorkspaceCatalogue(user.id);
    const deskOneVentures = await listVentureCatalogue(user.id, deskOne.id);
    const deskTwoVentures = await listVentureCatalogue(user.id, deskTwo.id);

    const southBoot = assembleDeskBoot({
      userId: user.id,
      workspaces,
      ventures: deskOneVentures,
      requestedWorkspaceId: deskOne.id,
      requestedVentureId: south.id,
    });
    assert.equal(southBoot?.workspace.id, deskOne.id);
    assert.equal(southBoot?.activeVenture?.id, south.id);

    const southSnapshot = await executeIntelligenceRuntime({
      userId: user.id,
      workspaceId: deskOne.id,
    });
    assert.ok(southSnapshot);
    assert.equal(southSnapshot.core.ventures.length, 2);

    const southRoom = projectSituationRoom(southSnapshot.core, {
      activeVentureId: south.id,
    });
    const northRoom = projectSituationRoom(southSnapshot.core, {
      activeVentureId: north.id,
    });
    assert.equal(southRoom.mission.company, "South Star");
    assert.equal(northRoom.mission.company, "North Star");
    assert.notEqual(southRoom.mission.company, northRoom.mission.company);

    const southOffice = projectExecutiveFloor(southSnapshot.core, {
      activeVentureId: south.id,
    });
    const northOffice = projectExecutiveFloor(southSnapshot.core, {
      activeVentureId: north.id,
    });
    assert.equal(typeof southOffice.posture, "string");
    assert.equal(typeof northOffice.posture, "string");

    const stale = assembleDeskBoot({
      userId: user.id,
      workspaces,
      ventures: [...deskOneVentures, ...deskTwoVentures],
      requestedWorkspaceId: deskTwo.id,
      requestedVentureId: south.id,
    });
    assert.equal(stale?.workspace.id, deskTwo.id);
    assert.equal(stale?.activeVenture?.id, west.id);
    assert.notEqual(stale?.activeVenture?.id, south.id);

    const westSnapshot = await executeIntelligenceRuntime({
      userId: user.id,
      workspaceId: deskTwo.id,
    });
    assert.ok(westSnapshot);
    assert.equal(westSnapshot.core.ventures.length, 1);
    assert.equal(westSnapshot.core.ventures[0]?.identity.name, "West Star");
  });
});
