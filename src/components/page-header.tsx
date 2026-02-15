import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
          {title}
        </h1>
        <p className="text-slate">{description}</p>
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  );
}
