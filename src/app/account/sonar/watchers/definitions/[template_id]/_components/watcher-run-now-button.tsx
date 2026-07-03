'use client';

import type { RunTemplate } from '@haiwave/protocol';
import { RunNowButton } from '../../../../_components/run-now-button';
import { describeApiError } from '@/lib/api-error';
import { buildWatcherRunBody } from '../../../_lib/build-watcher-run-body';

type WatcherTemplate = Extract<RunTemplate, { observation_class: 'watcher' }>;

interface Props {
  template: WatcherTemplate;
}

/**
 * Watcher's runs endpoint takes the scope inline (it doesn't yet have a
 * `/definitions/:id/run` counterpart like audit does). We replay the template's
 * own scope into the trigger body so the manually-fired run matches what a
 * scheduled fire would do.
 */
export function WatcherRunNowButton({ template }: Props) {
  return (
    <RunNowButton
      trigger={async () => {
        const res = await fetch('/api/account/sonar/watcher/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildWatcherRunBody(template.scope, template.template_id)),
        });
        if (!res.ok) {
          const info = await describeApiError(res);
          throw new Error(info.message);
        }
        const payload = (await res.json().catch(() => null)) as
          | { run_id?: string }
          | null;
        if (!payload?.run_id) {
          throw new Error('Trigger succeeded but the response was malformed.');
        }
        return { runId: payload.run_id };
      }}
      runDetailRoute="/account/sonar/watchers"
    />
  );
}
