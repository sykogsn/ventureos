"use client";

import { useState, useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { Popover } from "@/core/shell/popover";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { selectWorkspaceAction } from "@/modules/workspaces/actions";
import { CreateWorkspaceForm } from "@/modules/workspaces/create-form";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useShell();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="vos-control max-w-[11rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate text-foreground">
          {active?.name ?? "Workspace"}
        </span>
        <ChevronsUpDown className="ids-icon-sm ml-auto shrink-0 text-muted" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-72">
        {workspaces.length === 0 ? (
          <div className="px-2 py-3">
            <EmptyCopy title="Create a workspace">
              A workspace is the boundary for companies, membership and intelligence.
            </EmptyCopy>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
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
        )}
        <div className="mt-2 border-t border-border pt-2">
          <CreateWorkspaceForm />
        </div>
      </Popover>
    </div>
  );
}
