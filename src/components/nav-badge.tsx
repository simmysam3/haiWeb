interface NavBadgeProps {
  count: number;
  oldestAgeDays: number | null;
}

function toneClass(oldestAgeDays: number | null): string {
  if (oldestAgeDays === null || oldestAgeDays < 3) return 'bg-slate-500';
  if (oldestAgeDays <= 10) return 'bg-amber-500';
  return 'bg-red-500';
}

export function NavBadge({ count, oldestAgeDays }: NavBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      className={`${toneClass(oldestAgeDays)} text-white text-xs font-semibold px-1.5 py-0.5 rounded-full ml-2`}
      aria-label={`${count} items awaiting your action`}
    >
      {count}
    </span>
  );
}
