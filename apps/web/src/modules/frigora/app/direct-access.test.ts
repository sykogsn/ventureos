import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Role } from "@/contracts";
import {
  chooseFrigoraDirectAccess,
  decideFrigoraDirectAccess,
  FRIGORA_DIRECT_ACCESS_HOSTNAME,
  frigoraDirectDestination,
  frigoraSignedInLoginRedirect,
  isFrigoraDirectAccessHost,
  type AuthorisedFrigoraAccess,
} from "./direct-access";
import { FRIGORA_DIRECT_ENTRY_PATH } from "./pwa/paths";

const HOST = FRIGORA_DIRECT_ACCESS_HOSTNAME;

function access(
  overrides: Partial<AuthorisedFrigoraAccess> & Pick<AuthorisedFrigoraAccess, "id" | "workspaceId" | "role">,
): AuthorisedFrigoraAccess {
  return {
    name: overrides.name ?? overrides.id,
    workspaceName: overrides.workspaceName ?? overrides.workspaceId,
    ...overrides,
  };
}

describe("Frigora hostname entry", () => {
  it("recognises only the Frigora customer hostname", () => {
    assert.equal(isFrigoraDirectAccessHost(HOST), true);
    assert.equal(isFrigoraDirectAccessHost(` ${HOST.toUpperCase()}:443 `), true);
    assert.equal(isFrigoraDirectAccessHost(`${HOST}, internal.example`), true);
    assert.equal(isFrigoraDirectAccessHost("localhost"), false);
    assert.equal(isFrigoraDirectAccessHost("localhost:3000"), false);
    assert.equal(isFrigoraDirectAccessHost("ventureoperatingsystem.co.za"), false);
    assert.equal(isFrigoraDirectAccessHost(`not-${HOST}`), false);
    assert.equal(isFrigoraDirectAccessHost(`${HOST}.evil.example`), false);
    assert.equal(isFrigoraDirectAccessHost(`${HOST}@evil.example`), false);
    assert.equal(isFrigoraDirectAccessHost(null), false);
  });

  it("sends the Frigora root to branded login or the authorised entry", () => {
    assert.deepEqual(
      decideFrigoraDirectAccess({
        host: "srv.onrender.com",
        forwardedHost: HOST,
        pathname: "/",
        authenticated: false,
      }),
      { kind: "login" },
    );
    assert.deepEqual(
      decideFrigoraDirectAccess({
        host: HOST,
        forwardedHost: null,
        pathname: "/",
        authenticated: true,
      }),
      { kind: "enter" },
    );
    assert.deepEqual(
      decideFrigoraDirectAccess({
        host: "localhost:3000",
        forwardedHost: null,
        pathname: "/",
        authenticated: false,
      }),
      { kind: "continue" },
    );
  });

  it("leaves VentureOS routes, invitations, resets, and signup on their existing paths", () => {
    for (const pathname of [
      "/dashboard",
      "/ventures/launch",
      "/signup",
      "/forgot-password",
      "/forgot-password/sent",
      "/reset-password",
      "/invite",
      "/frigora",
      FRIGORA_DIRECT_ENTRY_PATH,
    ]) {
      assert.equal(
        decideFrigoraDirectAccess({
          host: HOST,
          forwardedHost: null,
          pathname,
          authenticated: false,
        }).kind,
        "continue",
        pathname,
      );
    }
    assert.equal(
      frigoraSignedInLoginRedirect({ host: HOST, forwardedHost: null, pathname: "/login" }),
      FRIGORA_DIRECT_ENTRY_PATH,
    );
    assert.equal(
      frigoraSignedInLoginRedirect({ host: HOST, forwardedHost: null, pathname: "/signup" }),
      null,
    );
    assert.equal(
      frigoraSignedInLoginRedirect({
        host: "localhost:3000",
        forwardedHost: null,
        pathname: "/login",
      }),
      null,
    );
  });

  it("keeps signup public in the request gate and does not embed the demonstration venture", () => {
    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    const root = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    const start = readFileSync(join(process.cwd(), "src/app/(app)/frigora/page.tsx"), "utf8");
    assert.match(proxy, /\/signup/);
    assert.match(proxy, /pathname === "\/invite"/);
    assert.match(proxy, /decideFrigoraDirectAccess/);
    assert.match(root, /\/dashboard/);
    assert.equal(start.includes("/ventures/launch"), false);
    assert.equal(start.includes("269b4f10-255b-429e-a678-bea4e67e1c88"), false);
    assert.equal(proxy.includes("269b4f10-255b-429e-a678-bea4e67e1c88"), false);
  });
});

describe("Frigora authorised destination", () => {
  it("sends owners and admins to Operations and field users to My Work", () => {
    const roles: Array<[Role, string]> = [
      ["owner", "/ventures/ven-1/operations"],
      ["admin", "/ventures/ven-1/operations"],
      ["member", "/ventures/ven-1/work/assigned"],
    ];
    for (const [role, path] of roles) {
      assert.equal(frigoraDirectDestination({ id: "ven-1", role }), path);
    }
    assert.equal(frigoraDirectDestination({ id: "../ven", role: "owner" }), null);
  });

  it("opens the sole authorised venture and refuses to guess among several", () => {
    const first = access({
      id: "ven-first",
      workspaceId: "ws-first",
      workspaceName: "Alpha Desk",
      role: "owner",
    });
    const second = access({
      id: "ven-second",
      workspaceId: "ws-second",
      workspaceName: "Zulu Field",
      role: "member",
    });
    assert.deepEqual(chooseFrigoraDirectAccess([second]), {
      mode: "open",
      path: "/ventures/ven-second/work/assigned",
      workspaceId: "ws-second",
      ventureId: "ven-second",
    });
    assert.deepEqual(chooseFrigoraDirectAccess([first, second]), { mode: "choose" });
    assert.deepEqual(chooseFrigoraDirectAccess([]), { mode: "choose" });
  });
});
