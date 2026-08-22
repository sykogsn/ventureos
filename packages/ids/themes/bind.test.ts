import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyIdsBrand, brandFromDefinitionId } from "./bind";

describe("IDS theme bind", () => {
  it("maps VentureOS Company and unknown ids to ventureos", () => {
    assert.equal(brandFromDefinitionId("ventureos.company"), "ventureos");
    assert.equal(brandFromDefinitionId(""), "ventureos");
    assert.equal(brandFromDefinitionId(null), "ventureos");
    assert.equal(brandFromDefinitionId("unknown.product"), "ventureos");
  });

  it("maps product definition ids to brand keys", () => {
    assert.equal(brandFromDefinitionId("qualora"), "qualora");
    assert.equal(brandFromDefinitionId("calviora"), "calviora");
    assert.equal(brandFromDefinitionId("farmora"), "farmora");
  });

  it("writes data-ids-brand and data-ids-atmosphere on the target element", () => {
    const target = { attributes: {} as Record<string, string> };
    applyIdsBrand(
      {
        setAttribute(name: string, value: string) {
          target.attributes[name] = value;
        },
      } as unknown as HTMLElement,
      "qualora",
    );
    assert.equal(target.attributes["data-ids-brand"], "qualora");
    assert.equal(target.attributes["data-ids-atmosphere"], "qualora");
  });
});
