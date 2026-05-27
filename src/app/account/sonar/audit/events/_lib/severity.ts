// Shared severity constants for the Events surface. Lives outside any
// `'use client'` module so both the Server Component page (which reads the
// default + validates the URL param) and the client FilterPills component
// (which renders the dropdown) can import the same values. Re-exporting
// these from a `'use client'` module turned the `Set` into a plain object
// at the RSC boundary in Next 16/Turbopack, breaking `SEVERITY_VALUES.has`.

export const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical Only' },
  { value: 'warning', label: 'Warning Only' },
  { value: 'all', label: 'All' },
] as const;

export const DEFAULT_SEVERITY = 'critical';

export const SEVERITY_VALUES: ReadonlySet<string> = new Set(
  SEVERITY_OPTIONS.map((o) => o.value),
);
