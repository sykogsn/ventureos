"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShell } from "@/core/context/shell-context";
import { useCommandExecutor } from "@/core/commands/use-command-executor";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { listCommandContributions } from "@/extensions";
import type { CommandContribution } from "@/extensions/types";
import { cn } from "@/utils/cn";
import {
  CommandEmpty,
  CommandField,
  CommandGroup,
  CommandList,
  CommandRegion,
} from "@/core/layout";

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
    <CommandRegion
      label={paletteMode === "ai" ? "Ask VentureOS" : "Command palette"}
      onDismiss={closePalette}
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
      <CommandField
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          paletteMode === "ai"
            ? "Ask VentureOS or run an intelligence command"
            : "Search commands and destinations"
        }
        aria-label={
          paletteMode === "ai" ? "Ask VentureOS" : "Search commands and destinations"
        }
      />
      <CommandList>
        {flat.length === 0 ? (
          <CommandEmpty>
            <EmptyCopy title={paletteMode === "ai" ? "No intelligence available" : "No matching command"}>
              {paletteMode === "ai"
                ? "Ask remains a command surface until the intelligence runtime is connected. Situation Room is the live brief."
                : "No destination matches. Try a company, a workspace, or a system command."}
            </EmptyCopy>
          </CommandEmpty>
        ) : (
          grouped.map((entry) => (
            <CommandGroup key={entry.group} label={groupLabels[entry.group]}>
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
            </CommandGroup>
          ))
        )}
      </CommandList>
    </CommandRegion>
  );
}
