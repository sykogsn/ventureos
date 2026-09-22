import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { frigoraWebAppManifest } from "@/modules/frigora/app/pwa/web-app-manifest";

const WEB_ROOT = join(process.cwd(), "src");

describe("Frigora runtime product-version observability", () => {
  it("exposes frigora@0.22.0 from the Definition Registry on the public manifest", () => {
    const authoritative = platformVentureRegistry.resolve("frigora");
    const manifest = frigoraWebAppManifest();

    assert.equal(authoritative.id, "frigora");
    assert.equal(authoritative.version, "0.22.0");
    assert.deepEqual(manifest.frigora_product, {
      id: authoritative.id,
      version: authoritative.version,
    });
    assert.equal(manifest.frigora_product.id, "frigora");
    assert.equal(manifest.frigora_product.version, "0.22.0");
  });

  it("derives manifest product version from the registry rather than a hardcoded constant", () => {
    const source = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/pwa/web-app-manifest.ts"),
      "utf8",
    );

    assert.match(source, /platformVentureRegistry\.resolve\("frigora"\)/);
    assert.match(source, /version:\s*definition\.version/);
    assert.match(source, /id:\s*definition\.id/);
    assert.equal(source.includes('"0.22.0"'), false);
    assert.equal(source.includes("'0.22.0'"), false);
    assert.equal(source.includes('"0.21.0"'), false);
    assert.equal(source.includes("'0.21.0'"), false);
    assert.equal(source.includes("0.20.0"), false);
  });

  it("preserves historical F3.1 certification evidence at frigora@0.20.0", () => {
    const cert = readFileSync(
      join(
        process.cwd(),
        "../../docs/engineering/FRIGORA_F3_1_CERTIFICATION.md",
      ),
      "utf8",
    );

    assert.match(cert, /frigora@0\.20\.0/);
    assert.equal(cert.includes("frigora@0.21.0"), false);
  });
});
