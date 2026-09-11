import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { credentialAutocomplete } from "./login-fields";

describe("login fields after logout", () => {
  it("turns autocomplete off so the browser does not look like VentureOS kept credentials", () => {
    assert.equal(credentialAutocomplete(true, "email"), "off");
    assert.equal(credentialAutocomplete(true, "password"), "off");
  });

  it("keeps password-manager hints when the founder is signing in", () => {
    assert.equal(credentialAutocomplete(false, "email"), "email");
    assert.equal(credentialAutocomplete(false, "password"), "current-password");
  });
});
