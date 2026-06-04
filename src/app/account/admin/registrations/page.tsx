import { redirect } from 'next/navigation';
import { PageHeader } from '@/components';
import { isAdmin } from '@/lib/admin-guard';
import { fetchBffJson } from '@/lib/server-fetch';
import { RegistrationsTable } from './registrations-table';
import type { RegistrationListItem } from '@/lib/registration-types';

interface ListPayload {
  requests: RegistrationListItem[];
}

// Admin gatekeeper queue — pending supplier registration requests awaiting
// adjudication. RSC: gate on isAdmin(), fetch the list through the BFF, hand
// plain rows to the client table adapter (no render closures cross the RSC
// boundary).
export default async function RegistrationsQueuePage() {
  if (!(await isAdmin())) redirect('/account');

  const result = await fetchBffJson<ListPayload>(
    '/api/admin/registration-requests?status=pending_approval',
  );
  const rows = result.kind === 'ok' ? result.data.requests : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Registration requests"
        description="Review and adjudicate pending supplier registrations."
      />
      {result.kind === 'error' && (
        <p className="text-sm text-problem">
          Could not load registration requests ({result.message}).
        </p>
      )}
      <RegistrationsTable rows={rows} />
    </div>
  );
}
