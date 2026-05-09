import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

interface TriggerSuccess {
  template_id: string;
  run_id: string;
}

interface TriggerFailure {
  template_id: string;
  error_message: string;
}

export const POST = withHaiCore(async ({ client }) => {
  const { templates } = await client.listRunTemplates();
  const enabled = templates.filter((t) => t.enabled);

  const settled = await Promise.allSettled(
    enabled.map(async (t) => {
      const res = await client.triggerRunTemplate(t.template_id);
      return { template_id: t.template_id, run_id: res.run_id } satisfies TriggerSuccess;
    }),
  );

  const triggered: TriggerSuccess[] = [];
  const failed: TriggerFailure[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      triggered.push(r.value);
    } else {
      const reason = r.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      failed.push({ template_id: enabled[i].template_id, error_message: msg });
    }
  });

  return NextResponse.json({ total: enabled.length, triggered, failed });
});
