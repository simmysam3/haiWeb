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

export function isTerminal(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status].terminal;
}

export function isUsableRun(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status].usable;
}
