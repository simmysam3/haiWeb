/**
 * The sentence a console panel shows for a non-ok BFF answer.
 *
 * A BFF route that handled the failure answers `{ error: "<sentence>" }`;
 * a haiCore 4xx relayed verbatim by `withHaiCore` answers haiCore's
 * envelope `{ error: { code, message, … } }` instead. Only a string is
 * renderable — handing the envelope object to a toast is exactly the
 * React child error that dropped the manifests tab into its boundary
 * (O-5, 2026-09-07). Anything but a non-empty string degrades to the
 * caller's own sentence; haiCore's codes and messages never reach the
 * screen through this path.
 */
export function bffErrorSentence(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null | undefined)?.error;
  return typeof error === "string" && error.length > 0 ? error : fallback;
}
