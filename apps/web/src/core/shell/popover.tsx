"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { OverlayPanel } from "@/core/layout";

export function Popover({
  open,
  onClose,
  align = "start",
  size = "sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  align?: "start" | "end";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        const root = ref.current.parentElement;
        if (root && root.contains(target)) {
          return;
        }
        onClose();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <OverlayPanel ref={ref} align={align} size={size}>
      {children}
    </OverlayPanel>
  );
}
