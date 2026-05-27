import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /**
   * One-line summary under the title. Optional — some pages just want the
   * title. Accepts ReactNode so callers can embed inline emphasis or counts.
   */
  description?: ReactNode;
  /**
   * Small uppercase line above the title — useful for nested pages to surface
   * their parent surface ("AUDIT", "PHANTOM DEMAND", "SONAR / TEMPLATES") in
   * lieu of a separate breadcrumb component.
   */
  eyebrow?: string;
  /**
   * Right-aligned slot for buttons, links, or controls. Stays vertically
   * aligned to the title row.
   */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-wider text-slate mb-1.5 font-medium">
            {eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-teal">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 gap-3">{actions}</div>}
    </header>
  );
}
