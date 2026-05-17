import type { ReactNode } from 'react';

export function StepCard({
  id,
  index,
  title,
  locked = false,
  dim = false,
  children,
}: {
  id: string;
  index: number;
  title: string;
  locked?: boolean;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`step-${id}`}
      className={[
        'scroll-mt-6 rounded-xl p-5 mb-3',
        locked
          ? 'bg-slate/5 border border-dashed border-slate/25'
          : 'bg-white border border-slate/15',
        dim ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          aria-hidden
          className={[
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-none',
            locked ? 'bg-slate/20 text-slate' : 'bg-teal/20 text-teal',
          ].join(' ')}
        >
          {locked ? '\u{1F512}' : index + 1}
        </span>
        <h2 className="text-sm font-semibold text-charcoal font-[family-name:var(--font-display)]">
          {title}
        </h2>
        {locked && (
          <span className="ml-auto text-[10px] font-semibold text-orange bg-orange/10 rounded-full px-2.5 py-1">
            Fixed at creation
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
