"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { Popover } from "@/core/shell/popover";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { selectVentureAction } from "@/modules/ventures/actions";
import { companyHomeHref } from "@/modules/ventures/home";
import { Anchor, Cluster, Inset, SwitcherBound } from "@/core/layout";

export function VentureSwitcher() {
  const router = useRouter();
  const { ventures, activeVentureId, setActiveVentureId } = useShell();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const active = ventures.find((venture) => venture.id === activeVentureId);

  return (
    <Anchor>
      <SwitcherBound size="md">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="vos-control"
          aria-label="Company"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Cluster justify="between" wrap={false}>
            <span className="truncate text-foreground">
              {active?.name ?? (activeVentureId ? activeVentureId : "Company")}
            </span>
            <ChevronsUpDown className="ids-icon-sm text-muted" />
          </Cluster>
        </button>
      </SwitcherBound>
      <Popover open={open} onClose={() => setOpen(false)}>
        {ventures.length === 0 ? (
          <Inset>
            <EmptyCopy title="No companies yet">
              Found a company to place it on this desk.
            </EmptyCopy>
          </Inset>
        ) : (
          <ul>
            {ventures.map((venture) => (
              <li key={venture.id}>
                <button
                  type="button"
                  className="vos-row"
                  onClick={() => {
                    setActiveVentureId(venture.id);
                    startTransition(() => {
                      void selectVentureAction(venture.id);
                    });
                    router.push(companyHomeHref(venture.slug));
                    setOpen(false);
                  }}
                >
                  {venture.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </Anchor>
  );
}
