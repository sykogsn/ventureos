import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LAYOUT_PRIMITIVES } from "./manifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const webSrc = join(root, "src");

const requiredFields = [
  "name",
  "purpose",
  "responsibilities",
  "allowedChildren",
  "forbiddenChildren",
  "responsive",
  "accessibility",
  "tokens",
  "example",
  "migration",
] as const;

const platformConcepts = [
  "Workspace",
  "NavigationRail",
  "WorkspaceCanvas",
  "Dashboard",
  "Document",
  "ReadingRegion",
  "Inspector",
  "Panel",
  "Toolbar",
  "StatusRegion",
  "CommandRegion",
  "Grid",
  "Flow",
  "Stack",
  "Cluster",
  "SplitView",
] as const;

const layoutTokens = [
  "--ids-foundation-layout-measure-sm",
  "--ids-foundation-layout-measure-md",
  "--ids-foundation-layout-measure-lg",
  "--ids-foundation-layout-measure-xl",
  "--ids-foundation-layout-sidebar-sm",
  "--ids-foundation-layout-sidebar-md",
  "--ids-foundation-layout-sidebar-lg",
  "--ids-foundation-layout-panel-sm",
  "--ids-foundation-layout-panel-md",
  "--ids-foundation-layout-panel-lg",
  "--ids-foundation-layout-grid-executive",
  "--ids-foundation-layout-grid-analytics",
  "--ids-foundation-layout-grid-ledger",
  "--ids-foundation-layout-toolbar",
  "--ids-foundation-layout-command-offset",
  "--ids-foundation-layout-rail",
  "--ids-foundation-layout-rail-wide",
  "--ids-foundation-layout-measure",
];

const authRoots = [join(webSrc, "modules/auth"), join(webSrc, "app/(auth)")];

const platformChrome = [
  "src/core/shell/os-shell.tsx",
  "src/core/shell/sidebar.tsx",
  "src/core/shell/page-frame.tsx",
  "src/core/shell/page-header.tsx",
  "src/core/shell/top-nav.tsx",
  "src/core/shell/executive-loading.tsx",
  "src/core/shell/empty-copy.tsx",
  "src/core/shell/command-palette.tsx",
  "src/core/shell/popover.tsx",
  "src/core/shell/workspace-switcher.tsx",
  "src/core/shell/venture-switcher.tsx",
  "src/core/shell/profile-menu.tsx",
  "src/core/shell/notification-center.tsx",
  "src/core/shell/icon-button.tsx",
  "src/core/shell/theme-toggle.tsx",
  "src/core/shell/deferred-operating-screen.tsx",
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
];

const productRoomRoots = [
  join(webSrc, "modules/situation-room"),
  join(webSrc, "modules/executive-office"),
  join(webSrc, "modules/brain"),
  join(webSrc, "modules/ventures"),
  join(webSrc, "modules/settings"),
  join(webSrc, "modules/dashboard"),
  join(webSrc, "modules/engineering-hq"),
  join(webSrc, "modules/frontend-foundation"),
];

const layoutAtom =
  /\b(?:flex|flex-col|flex-1|flex-wrap|grid|hidden|relative|absolute|sticky|fixed|grow|shrink-0|shrink|items-center|items-start|items-end|items-baseline|items-stretch|justify-center|justify-between|justify-end|justify-start|gap-\S+|p-\d|px-\S+|py-\S+|pt-\S+|pb-\S+|pl-\S+|pr-\S+|m-\d|mx-\S+|my-\S+|mt-\S+|mb-\S+|ml-\S+|mr-\S+|w-full|w-fit|w-\[|max-w-|min-h-|min-w-|h-full|lg:|sm:|md:|xl:|2xl:)\b/;

const arbitraryDimension =
  /(?:max-w-|min-w-|w-|h-|pt-|top-|left-|right-|min-h-)\[\d|w-60\b|w-72\b|w-80\b|h-14\b|max-w-(?:lg|xl|2xl|3xl)\b/;

const businessImport =
  /from ["']@\/core\/(?:runtime|capability|venture-definition)(?:\/[^"']*)?["']|runExecutiveIntelligenceRuntime|useShell\b|from ["']@\/modules\//;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (path.endsWith(".tsx") || path.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function classLiterals(source: string): string[] {
  const matches = source.matchAll(/className\s*=\s*(?:\{)?["'`]([^"'`]+)["'`]/g);
  return [...matches].flatMap((match) => (match[1] ? [match[1]] : []));
}

function layoutHits(source: string): string[] {
  return classLiterals(source).flatMap((value) =>
    layoutAtom.test(value) ? [value] : [],
  );
}

describe("Executive Layout Manifest", () => {
  it("names every primitive once", () => {
    const names = LAYOUT_PRIMITIVES.map((item) => item.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("records every required field on every primitive", () => {
    for (const primitive of LAYOUT_PRIMITIVES) {
      for (const field of requiredFields) {
        const value = primitive[field];
        assert.ok(value, `${primitive.name} missing ${field}`);
      }
    }
  });

  it("names the sixteen platform concepts", () => {
    const names = LAYOUT_PRIMITIVES.map((item) => item.name);
    for (const name of platformConcepts) {
      assert.ok(names.includes(name), `missing ${name}`);
    }
  });

  it("declares layout tokens on the foundation :root", () => {
    const foundation = readFileSync(
      join(root, "../../packages/ids/tokens/foundation.css"),
      "utf8",
    );
    for (const token of layoutTokens) {
      assert.ok(foundation.includes(token), `missing ${token}`);
    }
  });
});

describe("Layout primitives contain no business logic", () => {
  const files = walk(join(webSrc, "core/layout")).filter(
    (file) => file.endsWith(".tsx") || file.endsWith(".ts"),
  );

  for (const file of files) {
    if (file.endsWith(".test.ts")) {
      continue;
    }

    it(`${relative(root, file)} does not import Runtime, capabilities, definitions, or modules`, () => {
      const source = readFileSync(file, "utf8");
      assert.equal(businessImport.test(source), false);
    });
  }
});

describe("Layout primitives use tokens instead of arbitrary values", () => {
  const source = readFileSync(join(webSrc, "core/layout/primitives.tsx"), "utf8");

  it("does not hard-code layout rem or Tailwind width presets", () => {
    const hits = source
      .split("\n")
      .flatMap((line, index) =>
        arbitraryDimension.test(line) && !line.includes("var(--ids-foundation-")
          ? [`${index + 1}: ${line.trim()}`]
          : [],
      );
    assert.deepEqual(hits, []);
  });
});

describe("Authentication product layout", () => {
  const files = authRoots.flatMap((dir) => walk(dir));

  it("scans authentication product files", () => {
    assert.ok(files.length > 0);
  });

  for (const file of files) {
    it(`${relative(root, file)} does not compose Tailwind layout utilities`, () => {
      const source = readFileSync(file, "utf8");
      assert.deepEqual(layoutHits(source), []);
    });
  }
});

describe("Platform chrome consumes Workspace Layout primitives", () => {
  for (const file of platformChrome) {
    const path = join(root, file);
    const source = readFileSync(path, "utf8");

    it(`${file} imports @/core/layout`, () => {
      assert.ok(source.includes("@/core/layout"));
    });

    it(`${file} does not compose Tailwind layout utilities`, () => {
      assert.deepEqual(layoutHits(source), []);
    });
  }
});

describe("Remaining product rooms", () => {
  const files = productRoomRoots.flatMap((dir) => walk(dir));
  const debt = files
    .filter((file) => layoutHits(readFileSync(file, "utf8")).length > 0)
    .map((file) => relative(webSrc, file).replaceAll("\\", "/"))
    .sort();

  it("does not compose Tailwind layout utilities", () => {
    assert.deepEqual(debt, []);
  });
});
