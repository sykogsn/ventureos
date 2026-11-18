import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  browserDecisionFragmentStore,
  createDecisionFragmentStore,
  createStartupFlight,
  decisionPagePath,
  readDecisionFragment,
  rememberDecisionFragment,
  retainDecisionFragment,
} from "./quotation-decision-fragment";

const grantId = "grant-1";
const otherGrantId = "grant-2";

describe("customer decision fragment", () => {
  it("captures the initial fragment before the address bar is cleaned", () => {
    const store = createDecisionFragmentStore();
    const captured = retainDecisionFragment(grantId, "#secret-value", store);

    assert.equal(captured, "secret-value");
    assert.equal(store.get(grantId), "secret-value");
    assert.equal(decisionPagePath("/quotation-decision/grant-1", ""), "/quotation-decision/grant-1");
  });

  it("returns the captured value after repeated startup with the fragment removed", () => {
    const store = createDecisionFragmentStore();
    const first = retainDecisionFragment(grantId, "#secret-value", store);
    const second = retainDecisionFragment(grantId, "", store);
    const third = retainDecisionFragment(grantId, "#", store);

    assert.equal(first, "secret-value");
    assert.equal(second, "secret-value");
    assert.equal(third, "secret-value");
  });

  it("keeps a missing fragment invalid", () => {
    const store = createDecisionFragmentStore();

    assert.equal(readDecisionFragment(""), "");
    assert.equal(readDecisionFragment("#"), "");
    assert.equal(retainDecisionFragment(grantId, "", store), "");
    assert.equal(retainDecisionFragment(grantId, "#", store), "");
    assert.equal(store.get(grantId), undefined);
  });

  it("does not let a removed fragment replace another grant", () => {
    const store = createDecisionFragmentStore();
    retainDecisionFragment(grantId, "#secret-value", store);

    assert.equal(retainDecisionFragment(otherGrantId, "", store), "");
  });

  it("remembers the document fragment for the same grant after cleanup", () => {
    const store = createDecisionFragmentStore();
    const location = { pathname: "/quotation-decision/grant-1", hash: "#a%2Fb" };

    assert.equal(rememberDecisionFragment(location, store), "a/b");
    assert.equal(rememberDecisionFragment({ ...location, hash: "" }, store), "a/b");
    assert.equal(rememberDecisionFragment({ pathname: "/quotations", hash: "#a%2Fb" }, store), "");
  });

  it("uses one page memory for repeated browser store lookups", () => {
    const host = {};
    const first = browserDecisionFragmentStore(host);
    const second = browserDecisionFragmentStore(host);
    first.set(grantId, "secret-value");

    assert.equal(second.get(grantId), "secret-value");
    assert.equal(retainDecisionFragment(grantId, "", second), "secret-value");
  });
});

describe("customer review startup", () => {
  it("sends one review for repeated startup of the same attempt", async () => {
    const startFlight = createStartupFlight();
    let calls = 0;
    const start = () => {
      calls += 1;
      return Promise.resolve({ action: "review", grantId, secret: "secret-value" });
    };

    const first = startFlight(`${grantId}:0`, start);
    const second = startFlight(`${grantId}:0`, start);
    const body = await first;

    assert.equal(await second, body);
    assert.equal(calls, 1);
    assert.deepEqual(body, { action: "review", grantId, secret: "secret-value" });
  });

  it("allows a later explicit attempt to review again", async () => {
    const startFlight = createStartupFlight();
    let calls = 0;
    const start = () => {
      calls += 1;
      return Promise.resolve(calls);
    };

    assert.equal(await startFlight(`${grantId}:0`, start), 1);
    assert.equal(await startFlight(`${grantId}:1`, start), 2);
    assert.equal(calls, 2);
  });
});
