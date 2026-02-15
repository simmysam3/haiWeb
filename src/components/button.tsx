import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-charcoal",
  secondary: "bg-white text-charcoal border border-slate/20 hover:bg-light-gray",
  danger: "bg-problem text-white hover:bg-problem/80",
  ghost: "text-slate hover:text-charcoal hover:bg-light-gray",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", children, className = "", ...props }: ButtonProps) {
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
