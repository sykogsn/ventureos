import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary";

export function Button({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        variant === "primary" ? "vos-btn-primary" : "vos-btn-secondary",
        className,
      )}
      {...props}
    />
  );
}
