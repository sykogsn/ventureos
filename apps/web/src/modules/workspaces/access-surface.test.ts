import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(root, "access-panel.tsx"), "utf8");
const settings = readFileSync(join(root, "../settings/screens.tsx"), "utf8");
const invite = readFileSync(join(root, "invite-screen.tsx"), "utf8");
const accept = readFileSync(join(root, "accept-invitation-form.tsx"), "utf8");
const settingsPage = readFileSync(join(root, "../../app/(app)/settings/page.tsx"), "utf8");

describe("settings membership surface", () => {
  it("keeps membership on the canonical settings workspace section", () => {
    assert.match(settingsPage, /loadWorkspaceAccess/);
    assert.match(settings, /WorkspaceAccessPanel/);
    assert.match(settings, /title="Workspace"/);
    assert.doesNotMatch(settingsPage, /\/admin/);
  });

  it("exposes members, invitations, and invite controls with labels", () => {
    assert.match(panel, /Workspace members/);
    assert.match(panel, /Pending invitations/);
    assert.match(panel, /Invite member/);
    assert.match(panel, /htmlFor="invite-email"|id="invite-email"/);
    assert.match(panel, /Email/);
    assert.match(panel, /<legend className="ids-label">Role<\/legend>/);
    assert.match(panel, /Role: \{roleLabel\(member\.role\)\}/);
    assert.match(panel, /State: \{member\.state\}/);
    assert.match(panel, /State: \{invitation\.state\}/);
    assert.match(panel, /type="submit"/);
    assert.match(panel, /disabled=\{!canInvite \|\| pending\}/);
    assert.match(panel, /disabled=\{!member\.canChangeRole/);
    assert.match(panel, /aria-invalid=\{state\.error \? true : undefined\}/);
    assert.match(panel, /aria-describedby=/);
    assert.match(panel, /role="alert"/);
    assert.match(accept, /Accept invitation/);
    assert.match(accept, /aria-describedby=\{state\.error \? "invite-accept-error" : undefined\}/);
    assert.match(invite, /Create account/);
    assert.match(invite, /Sign in/);
  });
});
