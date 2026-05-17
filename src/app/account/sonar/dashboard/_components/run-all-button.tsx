'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';

interface Props {
  enabledTemplateCount: number;
}

interface RunAllResponse {
  total: number;
  triggered: Array<{ template_id: string; run_id: string }>;
  failed: Array<{ template_id: string; error_message: string }>;
}

export function RunAllButton({ enabledTemplateCount }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { mutate } = useSWRConfig();

  const disabled = isPending || enabledTemplateCount === 0;

  const onClick = async () => {
    setIsPending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/account/sonar/templates/run-all', { method: 'POST' });
      if (!res.ok) {
        setFeedback('Run all failed — check the Configurations page');
        return;
      }
      const body = (await res.json()) as RunAllResponse;
      const failedSuffix = body.failed.length > 0 ? ` (${body.failed.length} failed)` : '';
      setFeedback(`Triggered ${body.triggered.length} run${body.triggered.length === 1 ? '' : 's'}${failedSuffix}`);
      await mutate('/api/account/sonar/dashboard/activity');
    } catch {
      setFeedback('Run all failed — check the Configurations page');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {feedback && <span className="text-xs text-slate" role="status">{feedback}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={enabledTemplateCount === 0 ? 'No enabled configurations yet — create one in Configurations' : undefined}
        className="rounded-md bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Triggering…' : 'Run all'}
      </button>
    </div>
  );
}
