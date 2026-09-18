import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { DisclosurePolicyClient } from './_components/disclosure-policy-client';
import type { AttributeClassListResponse, DisclosurePolicyOverridesResponse, DisclosurePolicyResponse, RoomParticipationState } from '@/lib/safe-room-types';

export default async function DisclosurePolicyPage({ searchParams }: { searchParams: Promise<{ counterparty?: string }> }) {
  const { counterparty } = await searchParams;
  const [classesRes, policyRes, participationRes] = await Promise.all([
    fetchBffJson<AttributeClassListResponse>('/api/account/attribute-classes'),
    fetchBffJson<DisclosurePolicyResponse>('/api/account/disclosure-policy'),
    fetchBffJson<RoomParticipationState>('/api/account/room-participation'),
  ]);
  // Read only when a counterparty view was asked for (PF P24); the route serves every override
  // this participant has set, so filter to the one counterparty on screen.
  const overridesRes = counterparty
    ? await fetchBffJson<DisclosurePolicyOverridesResponse>('/api/account/disclosure-policy/overrides')
    : null;

  const classes = classesRes.kind === 'ok' ? classesRes.data.attribute_classes.filter((c) => c.status === 'adopted') : [];
  const policy: DisclosurePolicyResponse = policyRes.kind === 'ok' ? policyRes.data : { matrix: [] };
  const participation: RoomParticipationState = participationRes.kind === 'ok' ? participationRes.data : { global: true, per_class: {} };
  const overrides = overridesRes?.kind === 'ok' ? overridesRes.data.overrides.filter((o) => o.counterparty_participant_id === counterparty) : [];
  const error = [classesRes, policyRes, participationRes, overridesRes].find((r) => r?.kind === 'error');

  return (
    <div className="space-y-8">
      <PageHeader title="Disclosure Policy" description="How your agent answers qualified inquiries — the value, a verdict, or nothing — by attribute class and trust class." />
      {error && error.kind === 'error' && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error.message}</div>}
      <DisclosurePolicyClient classes={classes} policy={policy} participation={participation} overrides={overrides} counterparty={counterparty ?? null} />
    </div>
  );
}
