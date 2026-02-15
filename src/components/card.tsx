import { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-slate/15 p-6 ${className}`}>
      {title && (
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
