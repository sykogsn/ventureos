import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import { Children, isValidElement, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { createScope, type createFrigoraService } from "../service";
import * as errors from "../errors";
import * as validation from "../validation";
import * as domainTypes from "../types";
import type { UserId } from "@/contracts";
import type { FrigoraScope, FrigoraWorkOrder } from "../types";
import type { OfficeFormState } from "./mutation-actions";

// Execute the actual form adapters and authenticated actions, replacing only
// Next request context/cache and session lookup. Domain/store/SQLite stay real.
function loadSource(relative: string, imports: Record<string, unknown>, extra = "") {
  const filename = join(process.cwd(), "src/modules/frigora", relative);
  const source = readFileSync(filename, "utf8") + extra;
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports: Record<string, unknown> = {};
  const requireFixture = (name: string) => {
    assert.ok(name in imports, `Unexpected test import: ${name}`);
    return imports[name];
  };
  runInThisContext(`(function(require, exports) { ${compiled}\n})`, { filename })(requireFixture, exports);
  return exports;
}

export function confirmationHarness(
  service: ReturnType<typeof createFrigoraService>,
  actor: () => UserId | null,
) {
  const session = { getSession: async () => actor() ? { id: actor() } : null };
  const actions = loadSource("actions.ts", {
    "@/lib/auth/session": session, "./errors": errors, "./validation": validation,
    "./service": { createScope, getFrigoraService: () => service },
  });
  const forms = loadSource("app/mutation-actions.ts", {
    "next/cache": { revalidatePath: () => undefined },
    "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
    "@/lib/auth/session": session, "@/modules/frigora/actions": actions,
    "@/modules/frigora/types": domainTypes,
  }) as typeof import("./mutation-actions");

  function confirmation(state: OfficeFormState, scope: FrigoraScope, work: FrigoraWorkOrder, scheduling = false) {
    let dismissed: OfficeFormState | null = null;
    let submissions = 0;
    const action = scheduling ? forms.scheduleWorkOrderFormAction : forms.assignWorkOrderFormAction;
    const submit = (data: FormData) => { submissions += 1; return action({}, data); };
    // Supply controlled hook state to the real component; exercise its actual
    // hidden inputs, submitter and Cancel handler, not a duplicate UI contract.
    const component = loadSource("app/forms/dispatch-controls.tsx", {
      react: { useState: () => [dismissed, (next: OfficeFormState) => { dismissed = next; }] },
      "react/jsx-runtime": jsxRuntime, "@repo/ui/button": { Button: "button" },
      "@/core/layout": { Form: "form", Stack: "div" },
      "@/modules/frigora/app/mutation-actions": forms,
    }, "\nexport { DoubleBookingConfirmation };");
    const render = component.DoubleBookingConfirmation as (props: Record<string, unknown>) => ReactNode;
    const props = { state, action: submit, pending: false, scope: {
      ...scope, workOrderId: work.id, updatedAt: "must-not-replace-original-CAS",
      members: [], assignedUserId: work.assignedUserId,
    } };
    const fields = new FormData();
    let confirm: Record<string, unknown> | undefined;
    let cancel: Record<string, unknown> | undefined;
    function visit(node: ReactNode) {
      Children.forEach(node, (child) => {
        if (!isValidElement<Record<string, unknown>>(child)) return;
        if (typeof child.type === "function") {
          visit((child.type as (props: Record<string, unknown>) => ReactNode)(child.props));
          return;
        }
        if (child.type === "input") fields.append(String(child.props.name), String(child.props.value));
        if (child.type === "button" && child.props.type === "submit") confirm = child.props;
        if (child.type === "button" && child.props.type === "button") cancel = child.props;
        visit(child.props.children as ReactNode);
      });
    }
    const tree = render(props);
    assert.ok(tree, "Warning must render confirmation form");
    visit(tree);
    assert.ok(confirm);
    assert.ok(cancel);
    const confirmButton = confirm;
    const cancelButton = cancel;
    assert.equal(fields.has("confirmDoubleBooking"), false, "No hidden automatic confirmation");
    assert.equal(fields.get("expectedUpdatedAt"), state.values?.expectedUpdatedAt);
    return {
      fields,
      confirm: () => {
        const submitted = new FormData();
        fields.forEach((value, key) => submitted.append(key, value));
        submitted.append(String(confirmButton.name), String(confirmButton.value));
        assert.equal(submitted.get("confirmDoubleBooking"), "true");
        return submit(submitted);
      },
      cancel: () => {
        (cancelButton.onClick as () => void)();
        assert.equal(render(props), null);
        assert.equal(submissions, 0, "Cancel must not invoke the mutation action");
      },
    };
  }
  return { forms, confirmation };
}
