// Shared row-detail affordance — the "> in a circle" treatment used in the
// Actions column of run-history tables and similar row-click surfaces. Mirrors
// the styling that originated in compliance/run-exceptions-panel.tsx so all
// row-detail cues across the account portal look identical.
//
// Place inside an interactive ancestor (link or row) — the chevron itself is
// purely visual (`aria-hidden`). The ancestor must carry the accessible label
// and `group` class for the hover transition to fire.

export function DetailChevron() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal/10 text-teal transition-colors group-hover:bg-teal/20"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </span>
  );
}
