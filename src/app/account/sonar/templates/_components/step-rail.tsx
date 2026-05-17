'use client';

export type StepState = 'todo' | 'active' | 'done' | 'locked' | 'error';

export interface RailStep {
  id: string;
  label: string;
  state: StepState;
}

function badge(state: StepState, index: number) {
  if (state === 'locked') return '\u{1F512}';
  if (state === 'done') return '✓';
  if (state === 'error') return '!';
  return String(index + 1);
}

export function StepRail({
  steps,
  onJump,
}: {
  steps: RailStep[];
  onJump: (id: string) => void;
}) {
  return (
    <nav aria-label="Configuration steps" className="flex flex-col gap-1 min-w-[150px]">
      {steps.map((s, i) => {
        const active = s.state === 'active';
        const accessibleName =
          s.state === 'locked' ? `${s.label} (locked)` : s.label;
        return (
          <button
            key={s.id}
            type="button"
            aria-label={accessibleName}
            aria-current={active ? 'step' : undefined}
            onClick={() => onJump(s.id)}
            className={[
              'flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 text-left transition-colors',
              active
                ? 'font-semibold text-navy bg-white border border-slate/15'
                : s.state === 'done'
                  ? 'text-teal hover:bg-white/60'
                  : s.state === 'error'
                    ? 'text-rose-600 hover:bg-white/60'
                    : 'text-slate hover:bg-white/60',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold flex-none',
                active
                  ? 'bg-teal text-white'
                  : s.state === 'done'
                    ? 'bg-teal/25 text-teal'
                    : s.state === 'error'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate/15 text-slate',
              ].join(' ')}
            >
              {badge(s.state, i)}
            </span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
