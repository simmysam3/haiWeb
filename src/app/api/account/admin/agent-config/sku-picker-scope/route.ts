import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withHaiCore } from '@/lib/with-hai-core';
import { requireAdmin } from '@/lib/admin-guard';

const PatchSchema = z.object({
  agent_id: z.string().uuid(),
  sku_picker_scope: z.enum(['published_only', 'full_catalog']),
});

export const GET = withHaiCore(async ({ client, request }) => {
  await requireAdmin();
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id');
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }
  const cfg = await client.getAgentConfig(agentId);
  return NextResponse.json({ agent_id: cfg.agent_id, sku_picker_scope: cfg.sku_picker_scope });
});

export const PUT = withHaiCore(async ({ client, request }) => {
  await requireAdmin();
  const raw = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const cfg = await client.patchAgentConfig(parsed.data.agent_id, {
    sku_picker_scope: parsed.data.sku_picker_scope,
  });
  return NextResponse.json({ agent_id: cfg.agent_id, sku_picker_scope: cfg.sku_picker_scope });
});
