import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "primary";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  variant = "default",
  size = "md",
  className,
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={cn(
        "relative font-semibold uppercase tracking-wide rounded-xl transition-all duration-200",
        "text-white/80 hover:text-white",
        sizeClasses[size],
        // Glass background
        "bg-white/5 hover:bg-white/10",
        "backdrop-blur-xl",
        // Glass border effect via pseudo-element
        "before:absolute before:inset-0 before:rounded-xl before:p-[1px]",
        "before:bg-gradient-to-br before:from-white/50 before:via-white/10 before:to-white/50",
        "before:mask-composite-xor before:pointer-events-none",
        "[&::before]:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
        "[&::before]:[-webkit-mask-composite:xor]",
        // Active state
        "active:scale-[0.98]",
        variant === "primary" && "bg-primary/20 hover:bg-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
