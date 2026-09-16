import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listFrigoraPwaVentures,
  resolveFrigoraPwaStart,
} from "./landing";
import {
  FRIGORA_PWA_ICON_PATHS,
  FRIGORA_PWA_MANIFEST_PATH,
  FRIGORA_PWA_OFFLINE_PATH,
  FRIGORA_PWA_SERVICE_WORKER_PATH,
  FRIGORA_PWA_START_PATH,
  frigoraAssignedWorkPath,
  isFrigoraAuthContinuation,
  isFrigoraCustomerPath,
  isFrigoraFieldPath,
  isFrigoraPwaPublicPath,
} from "./paths";

describe("Frigora F3.2 PWA paths", () => {
  it("names Frigora start, assigned work, and public install assets", () => {
    assert.equal(FRIGORA_PWA_START_PATH, "/frigora");
    assert.equal(frigoraAssignedWorkPath("ven-frigora"), "/ventures/ven-frigora/work/assigned");
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_SERVICE_WORKER_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_OFFLINE_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_MANIFEST_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_ICON_PATHS.icon192), true);
    assert.equal(isFrigoraPwaPublicPath("/login"), false);
    assert.equal(isFrigoraPwaPublicPath("/dashboard"), false);
    assert.equal(isFrigoraAuthContinuation("/frigora"), true);
    assert.equal(
      isFrigoraAuthContinuation("/ventures/ven-1/work/assigned?from=pwa"),
      true,
    );
    assert.equal(isFrigoraAuthContinuation("/dashboard"), false);
    assert.equal(isFrigoraAuthContinuation("/login?next=/frigora"), false);
    assert.equal(
      isFrigoraAuthContinuation("/ventures/ven-1/operations"),
      true,
    );
    assert.equal(
      isFrigoraAuthContinuation("/ventures/ven-1/catalogue"),
      true,
    );
  });

  it("treats Frigora start and work routes as field surfaces", () => {
    assert.equal(isFrigoraFieldPath("/frigora"), true);
    assert.equal(isFrigoraFieldPath("/ventures/ven-1/work"), true);
    assert.equal(isFrigoraFieldPath("/ventures/ven-1/work/assigned"), true);
    assert.equal(isFrigoraFieldPath("/ventures/ven-1/operations"), false);
    assert.equal(isFrigoraFieldPath("/dashboard"), false);
  });

  it("treats Frigora ops and commercial surfaces as customer journeys", () => {
    assert.equal(isFrigoraCustomerPath("/frigora"), true);
    assert.equal(isFrigoraCustomerPath("/ventures/ven-1/work/assigned"), true);
    assert.equal(isFrigoraCustomerPath("/ventures/ven-1/operations"), true);
    assert.equal(isFrigoraCustomerPath("/ventures/ven-1/customers"), true);
    assert.equal(isFrigoraCustomerPath("/ventures/ven-1/catalogue"), true);
    assert.equal(isFrigoraCustomerPath("/ventures/ven-1/agents"), false);
    assert.equal(isFrigoraCustomerPath("/dashboard"), false);
    assert.equal(isFrigoraCustomerPath("/brain"), false);
    assert.equal(isFrigoraCustomerPath("/engineering"), false);
  });

  it("routes a single Frigora company to assigned work and keeps a picker otherwise", () => {
    assert.equal(
      resolveFrigoraPwaStart([
        { id: "ven-os", name: "Desk", definitionId: "ventureos.company" },
        { id: "ven-frigora", name: "Frigora One", definitionId: "frigora" },
      ]),
      "/ventures/ven-frigora/work/assigned",
    );
    assert.equal(
      resolveFrigoraPwaStart([
        { id: "ven-a", name: "A", definitionId: "frigora" },
        { id: "ven-b", name: "B", definitionId: "frigora" },
      ]),
      null,
    );
    assert.deepEqual(
      listFrigoraPwaVentures([
        { id: "ven-os", name: "Desk", definitionId: "ventureos.company" },
        { id: "ven-frigora", name: "Frigora One", definitionId: "frigora" },
      ]).map((row) => row.id),
      ["ven-frigora"],
    );
  });
});
