import type { WatcherScope } from '@haiwave/protocol';

/**
 * POST body for /api/account/sonar/watcher/runs, shared by every "run this
 * scope now" trigger (the definition detail's Run Now button and the new-
 * watcher wizard's run-on-create step) so a manual fire always replays the
 * same scope a scheduled fire would use.
 *
 * Empty-selection collapse is intentional and asymmetric: an empty
 * counterparties[] means "no filter — all tier-1" and must serialize to
 * `null`, while an empty skus[] means "no SKU filter" and must be omitted
 * from the JSON body (`undefined`), not sent as `[]`.
 */
export function buildWatcherRunBody(scope: WatcherScope, templateId: string) {
  return {
    signal_types: scope.signal_types,
    counterparty_filter: scope.counterparties.length > 0 ? scope.counterparties : null,
    skus: scope.skus.length > 0 ? scope.skus : undefined,
    depth_limit: scope.depth_limit,
    template_id: templateId,
  };
}
