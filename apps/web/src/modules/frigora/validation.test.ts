import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FrigoraError } from "./errors";
import {
  createAssetSchema,
  createCustomerSchema,
  parseWithFrigora,
} from "./validation";

describe("Frigora input validation", () => {
  it("trims required customer fields", () => {
    const parsed = parseWithFrigora(createCustomerSchema, {
      code: "  FUELCO  ",
      displayName: "  FuelCo  ",
    });
    assert.equal(parsed.code, "FUELCO");
    assert.equal(parsed.displayName, "FuelCo");
    assert.equal(parsed.legalName ?? null, null);
  });

  it("rejects empty required references", () => {
    assert.throws(
      () => parseWithFrigora(createCustomerSchema, { code: " ", displayName: "FuelCo" }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_input",
    );
  });

  it("rejects an unknown asset kind", () => {
    assert.throws(
      () =>
        parseWithFrigora(createAssetSchema, {
          siteId: "site-1",
          tag: "FZ-118",
          assetKind: "freezer",
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_kind",
    );
  });

  it("rejects a non-finite design target", () => {
    assert.throws(
      () =>
        parseWithFrigora(createAssetSchema, {
          siteId: "site-1",
          tag: "FZ-118",
          designTargetCelsius: Number.NaN,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_input",
    );
  });

  it("accepts a valid ISO date and design duty", () => {
    const parsed = parseWithFrigora(createAssetSchema, {
      siteId: "site-1",
      tag: "FZ-118",
      assetKind: "display_freezer",
      designTargetCelsius: -18,
      installedOn: "2024-01-15",
    });
    assert.equal(parsed.designTargetCelsius, -18);
    assert.equal(parsed.installedOn, "2024-01-15");
  });
});
