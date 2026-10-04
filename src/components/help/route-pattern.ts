// src/components/help/route-pattern.ts
import { HELP_PAGE_ROUTE_MAX_CHARS } from '@haiwave/protocol';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const NUMERIC = /^\d+$/;
// A 16+ character token of id characters that contains at least one digit.
// Route literals (`grounded-forecasts`, `trust-posture`) carry no digits.
const LONG_OPAQUE = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;

function isIdSegment(segment: string): boolean {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Malformed escape: judge the raw segment.
  }
  return UUID.test(decoded) || ULID.test(decoded) || NUMERIC.test(decoded) || LONG_OPAQUE.test(decoded);
}

/**
 * The page's route *pattern*: record ids become `[id]`, so no id leaves the
 * browser (spec §7.2). haiCore matches it against console-pages.md headings,
 * whose `[param]` segments are wildcards (contract C.5).
 */
export function toRoutePattern(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '';
  const segments = path
    .split('/')
    .filter((s) => s !== '')
    .map((s) => (isIdSegment(s) ? '[id]' : s));
  return `/${segments.join('/')}`.slice(0, HELP_PAGE_ROUTE_MAX_CHARS);
}
