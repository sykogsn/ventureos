"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/core/theme/theme-provider";
import { Cluster, Stack } from "@/core/layout";

const options = [
  { id: "light", label: "Executive Light" },
  { id: "dark", label: "Executive Dark" },
  { id: "system", label: "System" },
] as const;

export function SettingsAppearance() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return <p className="ids-kicker">Preparing appearance…</p>;
  }

  return (
    <Stack gap="compact">
      <Cluster justify="start">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            className={theme === option.id ? "vos-btn-primary" : "vos-btn-secondary"}
          >
            {option.label}
          </button>
        ))}
      </Cluster>
      <p className="ids-caption">
        Climate is Executive Light or Executive Dark. It persists in this
        browser and applies on every page. Product atmospheres (Qualora,
        Calviora, Farmora) bind from the company on this desk. Midnight and
        Slate are not climates.
      </p>
    </Stack>
  );
}
