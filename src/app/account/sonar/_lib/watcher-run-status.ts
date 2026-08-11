import type { WatcherRunStatus } from '@haiwave/protocol';

/**
 * Status semantics in ONE exhaustive table. This is a Record over the full
 * protocol union deliberately: when a 7th WatcherRunStatus member is minted,
 * this file fails the BUILD instead of a comparison chain silently
 * mis-rendering it (v1.73 WP4 §3.6). Type-import only — client components
 * may never value-import @haiwave/protocol (Turbopack + CJS + file: symlink).
 *
 *   terminal — the run will not change again on its own ('throttled' is NOT
 *              terminal: it resumes automatically when budget refreshes).
 *   usable   — the run produced results a reader may consume
 *              (complete or partial; failed/cancelled runs may carry partial
 *              rows but are not presented as a usable latest run).
 */
export const STATUS_TRAITS: Record<
  WatcherRunStatus,
  { terminal: boolean; usable: boolean }
> = {
  running: { terminal: false, usable: false },
  throttled: { terminal: false, usable: false },
  complete: { terminal: true, usable: true },
  partial: { terminal: true, usable: true },
  failed: { terminal: true, usable: false },
  cancelled: { terminal: true, usable: false },
};

// The `?.` / `?? false` below guard a value that was never in the TypeScript
// union to begin with — a wire status a newer core serves (protocol version
// skew is standing in this lane: haiWeb symlinks 3.64.0 while WP1/WP3 mint
// 3.65.0/3.66.0) that this build's WatcherRunStatus type has never heard of.
// The Record type above, not this lookup, is what enforces exhaustiveness at
// build time — don't "simplify" this back to a direct index; that turns an
// unrecognized wire status into a render-time throw instead of a harmless
// not-terminal/not-usable degrade (matching what the old comparison chains
// did on the same input).
export function isTerminal(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status]?.terminal ?? false;
}

export function isUsableRun(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status]?.usable ?? false;
}
