// Shared row-detail affordance — the "> in a circle" treatment used wherever
// a row, list item, or summary reveals more detail (either by navigating to a
// detail page or by expanding inline). Place inside an interactive ancestor
// (link or row) — the chevron itself is purely visual (`aria-hidden`). The
// ancestor must carry the accessible label and `group` class for the hover
// transition to fire.
//
// USAGE
//   <Link href={...} aria-label="..." className="group inline-flex">
//     <DetailChevron />
//   </Link>
//
// EXPANDER VARIANT (inline drill-downs that toggle open/closed)
//   <button onClick={...} aria-expanded={isOpen} className="group ...">
//     <DetailChevron expanded={isOpen} />
//   </button>
//
// When `expanded` is true the chevron rotates 90deg so it points down,
// matching the established expand/collapse convention.

interface Props {
  /** True when the affordance has been activated (expanded). Rotates the
   *  chevron 90deg so it points down. Defaults to false. */
  expanded?: boolean;
}

export function DetailChevron({ expanded = false }: Props = {}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal/10 text-teal transition-colors group-hover:bg-teal/20"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
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
