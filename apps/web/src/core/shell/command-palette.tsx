"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShell } from "@/core/context/shell-context";
import { useCommandExecutor } from "@/core/commands/use-command-executor";
import { listCommandContributions } from "@/extensions";
import type { CommandContribution } from "@/extensions/types";
import { cn } from "@/utils/cn";

const groupLabels = {
  ai: "Intelligence",
  navigation: "Navigate",
  system: "System",
} as const;

function matches(command: CommandContribution, query: string) {
  const haystack = [command.title, ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function CommandPalette() {
  const { isPaletteOpen, paletteMode, closePalette, openPalette } = useShell();
  const execute = useCommandExecutor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo(() => {
    const all = listCommandContributions().filter(
      (command) => command.action !== "palette.open",
    );
    const scoped =
      paletteMode === "ai"
        ? all.filter(
            (command) =>
              command.group === "ai" && command.action !== "palette.ai",
          )
        : all;
    const filtered = query ? scoped.filter((command) => matches(command, query)) : scoped;

    return filtered;
  }, [paletteMode, query]);

  useEffect(() => {
    if (!isPaletteOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    inputRef.current?.focus();
  }, [isPaletteOpen, paletteMode]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, paletteMode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isPaletteOpen) {
          closePalette();
        } else {
          openPalette(event.shiftKey ? "ai" : "command");
        }
      }

      if (meta && event.key.toLowerCase() === "i") {
        event.preventDefault();
        openPalette("ai");
      }

      if (event.key === "Escape" && isPaletteOpen) {
        closePalette();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, isPaletteOpen, openPalette]);

  if (!isPaletteOpen) {
    return null;
  }

  function run(command: CommandContribution) {
    if (command.action === "palette.ai") {
      openPalette("ai");
      return;
    }

    closePalette();
    execute(command);
  }

  const grouped = (["ai", "navigation", "system"] as const)
    .map((group) => ({
      group,
      items: commands.filter((command) => command.group === group),
    }))
    .filter((entry) => entry.items.length > 0);

  const flat = grouped.flatMap((entry) => entry.items);

  return (
    <div className="fixed inset-0 z-dialog flex items-start justify-center ids-overlay px-4 pt-[15vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={closePalette}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={paletteMode === "ai" ? "Ask VentureOS" : "Command palette"}
        className="relative z-10 w-full max-w-xl overflow-hidden ids-surface-modal"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closePalette();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, Math.max(flat.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter") {
            const command = flat[activeIndex];
            if (command) {
              event.preventDefault();
              run(command);
            }
          }
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            paletteMode === "ai"
              ? "Ask VentureOS or run an intelligence command"
              : "Search commands and destinations"
          }
          className="ids-label h-12 w-full border-b border-border bg-transparent px-4 outline-none placeholder:text-muted focus-visible:ring-0"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="ids-body px-2 py-8 text-center text-muted">
              {paletteMode === "ai"
                ? "Ask remains a command surface until the intelligence runtime is connected. Situation Room is the live brief."
                : "No destination matches. Try a company, a workspace, or a system command."}
            </p>
          ) : (
            grouped.map((entry) => (
              <div key={entry.group} className="mb-2">
                <p className="ids-kicker px-2 py-2">
                  {groupLabels[entry.group]}
                </p>
                <ul>
                  {entry.items.map((command) => {
                    const index = flat.indexOf(command);
                    return (
                      <li key={command.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => run(command)}
                          className={cn(
                            "vos-row",
                            index === activeIndex
                              ? "ids-surface-selected text-foreground"
                              : "text-muted hover:text-foreground",
                          )}
                        >
                          {command.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
