import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ControlButton } from "@/core/layout";

export function IconButton({
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { children: ReactNode }) {
  return <ControlButton {...props}>{children}</ControlButton>;
}
