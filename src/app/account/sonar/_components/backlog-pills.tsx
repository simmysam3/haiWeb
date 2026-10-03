'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The status / cause filter of a Sourcing Map backlog. `active` is the page's RESOLVED list (never the raw
 * URL: with no `?status=` the default is still pressed), so a click toggles from what the viewer sees.
 * Plain toggle buttons, not Pills. Any cursor is dropped: a new filter starts on its first page.
 */
export function BacklogPills({ param, pills, active }: {
  param: 'status' | 'cause';
  pills: ReadonlyArray<{ value: string; label: string }>;
  active: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete(param);
    const next = active.includes(value) ? active.filter((v) => v !== value) : [...active, value];
    for (const v of next) sp.append(param, v);
    sp.delete('cursor');
    router.push(`${pathname}?${sp}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {pills.map((p) => {
        const on = active.includes(p.value);
        return (
          <button
            key={p.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p.value)}
            className={`rounded border px-3 py-1 text-xs font-medium ${on ? 'border-navy bg-navy text-white' : 'border-slate/30 bg-white text-slate hover:border-navy'}`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
