'use client';

import { RunNowButton } from '../../../../_components/run-now-button';
import { describeApiError } from '@/lib/api-error';

interface Props {
  templateId: string;
}

export function AuditRunNowButton({ templateId }: Props) {
  return (
    <RunNowButton
      trigger={async () => {
        const res = await fetch(
          `/api/account/sonar/audit/definitions/${templateId}/run`,
          { method: 'POST' },
        );
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
      runDetailRoute="/account/sonar/audit"
    />
  );
}
