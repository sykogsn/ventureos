import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { VentureId, WorkspaceId } from "../../contracts";
import { DEFAULT_VENTURE_DEFINITION_REF } from "../venture-definition";
import {
  assertVentureDefinitionRef,
  assertVentureInWorkspace,
  definitionRefFromStored,
  resolveActiveVenture,
  toVentureRegistryEntry,
} from "./index";
import type { VentureRegistryEntry } from "./types";

const here = dirname(fileURLToPath(import.meta.url));

function entry(
  id: string,
  workspaceId: string,
  definitionId = DEFAULT_VENTURE_DEFINITION_REF.id,
): VentureRegistryEntry {
  return toVentureRegistryEntry({
    id: id as VentureId,
    workspaceId: workspaceId as WorkspaceId,
    name: id,
    slug: id,
    definitionId,
    definitionVersion: DEFAULT_VENTURE_DEFINITION_REF.version,
  });
}

describe("Venture Registry", () => {
  it("keeps companies scoped to one workspace and fails across workspaces", () => {
    const ventures = [entry("co-a", "ws-a"), entry("co-b", "ws-a")];
    assert.equal(assertVentureInWorkspace(ventures, "co-b", "ws-a" as WorkspaceId).id, "co-b");
    assert.throws(
      () => assertVentureInWorkspace(ventures, "co-a", "ws-other" as WorkspaceId),
      { message: "Unknown company." },
    );
  });

  it("always carries a definition ref, including empty stored columns", () => {
    const ref = definitionRefFromStored("", "");
    assert.deepEqual(ref, DEFAULT_VENTURE_DEFINITION_REF);
    const company = entry("co-a", "ws-a", "qualora");
    assert.equal(company.definition.id, "qualora");
    assert.doesNotThrow(() => assertVentureDefinitionRef(company));
  });

  it("resolves Qualora, Calviora, and Farmora refs through the Definition Registry only", () => {
    for (const id of ["qualora", "calviora", "farmora", "ventureos.company"] as const) {
      const company = entry("co", "ws", id);
      assert.doesNotThrow(() => assertVentureDefinitionRef(company));
    }
    assert.throws(
      () =>
        assertVentureDefinitionRef({
          ...entry("co", "ws"),
          definition: { id: "unknown.product", version: "1.0.0" },
        }),
      { message: "Unknown company definition." },
    );
  });

  it("falls back to the first company in the workspace when the requested id is foreign", () => {
    const ventures = [entry("co-a", "ws-a"), entry("co-b", "ws-a")];
    assert.equal(resolveActiveVenture(ventures, "co-b")?.id, "co-b");
    assert.equal(resolveActiveVenture(ventures, "co-foreign")?.id, "co-a");
    assert.equal(resolveActiveVenture([], "co-a"), null);
  });

  it("does not import Runtime", () => {
    const source = [
      readFileSync(join(here, "registry.ts"), "utf8"),
      readFileSync(join(here, "assert.ts"), "utf8"),
      readFileSync(join(here, "types.ts"), "utf8"),
    ].join("\n");
    assert.doesNotMatch(source, /runExecutiveIntelligenceRuntime|core\/runtime/);
  });
});
