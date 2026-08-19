"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { Popover } from "@/core/shell/popover";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { companyHomeHref } from "@/modules/ventures/home";

export function VentureSwitcher() {
  const router = useRouter();
  const { ventures, activeVentureId, setActiveVentureId } = useShell();
  const [open, setOpen] = useState(false);
  const active = ventures.find((venture) => venture.id === activeVentureId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="vos-control max-w-[12rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate text-foreground">
          {active?.name ?? (activeVentureId ? activeVentureId : "Company")}
        </span>
        <ChevronsUpDown className="ids-icon-sm ml-auto shrink-0 text-muted" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        {ventures.length === 0 ? (
          <div className="px-2 py-3">
            <EmptyCopy title="No company in view">
              Found a company to place it on this desk.
            </EmptyCopy>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {ventures.map((venture) => (
              <li key={venture.id}>
                <button
                  type="button"
                  className="vos-row"
                  onClick={() => {
                    setActiveVentureId(venture.id);
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
    </div>
  );
}
