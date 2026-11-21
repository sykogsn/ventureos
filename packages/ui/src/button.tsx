import { createElement, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary";

export function Button({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  // Use the same React element in Next and the Node TSX regression renderer.
  return createElement("button", {
    type,
    className: cn(
      variant === "primary" ? "vos-btn-primary" : "vos-btn-secondary",
      className,
    ),
    ...props,
  });
}
