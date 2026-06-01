interface NavBadgeProps {
  count: number;
  // Retained for call-site compatibility; no longer drives the badge color.
  // Watcher/backlog events accumulate over long durations, so an age-based
  // gray/amber/red escalation just read as "always red" and added no signal.
  // The badge is now always the brand orange, count-only.
  oldestAgeDays?: number | null;
}

export function NavBadge({ count }: NavBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      className="bg-orange text-white text-xs font-semibold px-1.5 py-0.5 rounded-full ml-2"
      aria-label={`${count} items awaiting your action`}
    >
      {count}
    </span>
  );
}
