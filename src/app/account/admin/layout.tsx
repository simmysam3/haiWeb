import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/account');
  return (
    <div className="space-y-4">
      <div className="rounded bg-slate-50 px-4 py-3 text-xs uppercase tracking-wide text-slate-600">
        Admin
      </div>
      {children}
    </div>
  );
}
