import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withHaiCore } from '@/lib/with-hai-core';
import { requireAdmin } from '@/lib/admin-guard';

const MesConfigSchema = z.object({
  endpoint_url: z.string().url(),
  auth_scheme: z.string().min(1),
  credential_ref: z.string().min(1),
  work_center_mapping: z.record(z.string()),
});

const PatchSchema = z.object({
  agent_id: z.string().uuid(),
  mes_enabled: z.boolean(),
  mes_config: MesConfigSchema.nullable(),
});

export const GET = withHaiCore(async ({ client, request }) => {
  await requireAdmin();
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id');
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }
  const cfg = await client.getAgentConfig(agentId);
  return NextResponse.json({
    agent_id: cfg.agent_id,
    mes_enabled: cfg.mes_enabled,
    mes_config: cfg.mes_config,
  });
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
    mes_enabled: parsed.data.mes_enabled,
    mes_config: parsed.data.mes_config,
  });
  return NextResponse.json({
    agent_id: cfg.agent_id,
    mes_enabled: cfg.mes_enabled,
    mes_config: cfg.mes_config,
  });
});
