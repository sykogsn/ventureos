"use client";

import { useState } from "react";
import Link from "next/link";
import { useShell } from "@/core/context/shell-context";
import { Popover } from "@/core/shell/popover";
import { logoutAction } from "@/modules/auth/actions";
import { Anchor, Hairline, Inset, Stack } from "@/core/layout";
import { IconButton } from "@/core/shell/icon-button";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`;
  return letters.toUpperCase() || "V";
}

export function ProfileMenu() {
  const { user } = useShell();
  const [open, setOpen] = useState(false);

  return (
    <Anchor>
      <IconButton
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(user.name)}
      </IconButton>
      <Popover open={open} onClose={() => setOpen(false)} align="end" size="md">
        <Inset>
          <p className="ids-label text-foreground">{user.name}</p>
          <p className="ids-caption">{user.email}</p>
        </Inset>
        <Hairline>
          <Stack gap="tight">
            <Link
              href="/settings"
              className="vos-row"
              onClick={() => setOpen(false)}
            >
              Open settings
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="vos-row">
                Sign out
              </button>
            </form>
          </Stack>
        </Hairline>
      </Popover>
    </Anchor>
  );
}
