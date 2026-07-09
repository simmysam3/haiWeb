/**
 * Company/demo fingerprint patterns that must never appear in the distributed
 * agent archive. Curated for specificity — bare common tokens (beta, apex, gore,
 * ti) are intentionally omitted; those companies are caught via full-name,
 * product-prefix, or UUID patterns to avoid false positives on ordinary words.
 * Keep in sync with the spec's denylist and the haiClient seed-data companies.
 */
export const DENYLIST = [
  // Full names / slugs
  /amphenol/i, /apex\s+manufacturing/i, /apex\s+brass/i, /summit\s+electrical/i,
  /precision\s+plastics/i, /delta\s*flow/i, /lyn-?tron/i, /great\s+lakes\s+hardware/i,
  /midwest\s+fastener/i, /national\s+industrial/i, /pacific\s+safety/i, /w\.?m\.?\s*gore/i,
  /huntwood/i, /us\s?steel/i, /sel\s+inc/i, /selinc/i, /deltaflow/i, /greatlakes/i,
  /lyntron/i, /ussteel/i, /\beg4\b/i,
  // Product-ID prefixes
  // Note: SEC- intentionally dropped — collides with the pervasive
  // security-decision IDs (SEC-1, SEC-5, SEC-10(b), SEC-13) used in the
  // adopter-facing .env.example and UPGRADING.md. Summit Electrical remains
  // caught by the /summit\s+electrical/i full-name pattern above.
  /\bLYN-/, /\bAPEX-/, /\bMWF-/, /\bNIS-/, /\bPSP-/, /\bANS-/, /\bPPC-/,
  /\bDFS-/, /\bGORE-/, /\bGLH-/,
  // Demo cast
  /\bnike\b/i, /\boia\b/i, /\bcsg\b/i, /vomero/i,
  // Demo participant UUIDs
  /8b7ecca6-b704-4d2b-896c-801898135fdf/i,
  /e755e710-0680-42d2-a9ee-938456ec7e69/i,
  /ec2308a1-08e4-4f87-bf39-43fb98bef8ff/i,
  /3513cae6-f196-4c79-b2cd-3a508770ad5c/i,
  /32509c89-d9ff-4d4a-b11e-8b09d47b2287/i,
  /2de15fcf-f0fc-45ae-8702-1650f8fd45ae/i,
];
