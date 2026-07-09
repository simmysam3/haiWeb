interface ComingSoonProps {
  /** Optional one-line note about what this page will do once it ships. */
  note?: string;
}

/**
 * Placeholder body for a page whose feature is not yet built. Renders under the
 * page's PageHeader so the section title and description still stand, with an
 * honest "Coming soon" note instead of fabricated demo data.
 */
export function ComingSoon({ note }: ComingSoonProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate/15 bg-white p-10 text-center">
      <p className="text-sm font-semibold text-navy">Coming soon</p>
      {note && <p className="mx-auto mt-2 max-w-md text-sm text-slate">{note}</p>}
    </div>
  );
}
