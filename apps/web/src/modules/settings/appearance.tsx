"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/core/theme/theme-provider";

const options = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
] as const;

export function SettingsAppearance() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return <p className="ids-kicker">Preparing appearance…</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
