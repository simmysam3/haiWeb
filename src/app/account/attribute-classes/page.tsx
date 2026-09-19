import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { AttributeClassesClient } from './_components/attribute-classes-client';
import type { AttributeClassListResponse, AttributeClassProposalListResponse } from '@/lib/safe-room-types';

export default async function AttributeClassesPage() {
  const [classesRes, proposalsRes] = await Promise.all([
    fetchBffJson<AttributeClassListResponse>('/api/account/attribute-classes'),
    fetchBffJson<AttributeClassProposalListResponse>('/api/account/attribute-classes/proposals'),
  ]);
  const classes = classesRes.kind === 'ok' ? classesRes.data.attribute_classes.filter((c) => c.status === 'adopted') : [];
  const proposals = proposalsRes.kind === 'ok' ? proposalsRes.data.proposals : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Attribute Classes" description="The registry of attributes qualified inquiries can be asked about — propose a new one for platform adoption (spec §4.3)." />
      <AttributeClassesClient classes={classes} initialProposals={proposals} />
    </div>
  );
}
