import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-guard';
import { fetchBffJson } from '@/lib/server-fetch';
import { RegistrationDetail } from './registration-detail';
import type { RegistrationDetail as Detail } from '@/lib/registration-types';

interface DetailPayload {
  request: Detail;
}

// Admin gatekeeper detail — one registration request with approve/reject.
export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect('/account');

  const { id } = await params;
  const result = await fetchBffJson<DetailPayload>(
    `/api/admin/registration-requests/${encodeURIComponent(id)}`,
  );
  if (result.kind === 'error') {
    if (result.status === 404) notFound();
    return (
      <div className="space-y-4">
        <Link href="/account/admin/registrations" className="text-sm text-teal-700 hover:underline">
          ← Registration requests
        </Link>
        <p className="text-sm text-problem">
          Could not load this registration request ({result.message}).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/account/admin/registrations" className="text-sm text-teal-700 hover:underline">
        ← Registration requests
      </Link>
      <RegistrationDetail detail={result.data.request} />
    </div>
  );
}
