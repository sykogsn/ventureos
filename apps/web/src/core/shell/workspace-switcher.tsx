"use client";

import { useState, useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { Popover } from "@/core/shell/popover";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { selectWorkspaceAction } from "@/modules/workspaces/actions";
import { CreateWorkspaceForm } from "@/modules/workspaces/create-form";
import { Anchor, Cluster, Hairline, Inset, Stack, SwitcherBound } from "@/core/layout";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useShell();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  return (
    <Anchor>
      <SwitcherBound size="sm">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="vos-control"
          aria-label="Workspace"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Cluster justify="between" wrap={false}>
            <span className="truncate text-foreground">
              {active?.name ?? "Workspace"}
            </span>
            <ChevronsUpDown className="ids-icon-sm text-muted" />
          </Cluster>
        </button>
      </SwitcherBound>
      <Popover open={open} onClose={() => setOpen(false)} size="md">
        {workspaces.length === 0 ? (
          <Inset>
            <EmptyCopy title="No workspace yet">
              A workspace is the boundary for companies, membership and intelligence. Create one
              below.
            </EmptyCopy>
          </Inset>
        ) : (
          <Stack gap="tight">
            <ul>
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <button
                    type="button"
                    className="vos-row"
                    onClick={() => {
                      setActiveWorkspaceId(workspace.id);
                      startTransition(() => {
                        void selectWorkspaceAction(workspace.id);
                      });
                      setOpen(false);
                    }}
                  >
                    {workspace.name}
                  </button>
                </li>
              ))}
            </ul>
          </Stack>
        )}
        <Hairline>
          <CreateWorkspaceForm />
        </Hairline>
      </Popover>
    </Anchor>
  );
}
