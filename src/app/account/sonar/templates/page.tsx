import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import type { RunTemplate } from '@haiwave/protocol';
import { formatCadence } from './_lib/format-cadence';

interface TemplatesPayload {
  templates: RunTemplate[];
}

async function loadTemplates(): Promise<RunTemplate[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/account/sonar/templates`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as TemplatesPayload;
    return payload.templates ?? [];
  } catch (err) {
    console.error('[templates list] fetch failed', err);
    return [];
  }
}

export default async function TemplatesListPage() {
  const templates = await loadTemplates();
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Run Templates</h1>
          <p className="text-sm text-slate mt-1">
            Reusable observation configurations. Cadence (manual / daily / weekly /
            event-triggered) is set per template; scheduled templates fire automatically.
          </p>
        </div>
        <Link
          href="/account/sonar/templates/new"
          className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
        >
          New template
        </Link>
      </header>

      {templates.length === 0 ? (
        <p className="text-sm text-slate">
          No templates yet. Create one or use &ldquo;Save as template&rdquo; from
          the audit or Type 2 dashboard after a manual run.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
              <th className="py-2">Name</th>
              <th className="py-2">Modality</th>
              <th className="py-2">Cadence</th>
              <th className="py-2">Enabled</th>
              <th className="py-2">Last run</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.template_id} className="border-b border-slate-100">
                <td className="py-2">
                  <Link
                    href={`/account/sonar/templates/${t.template_id}`}
                    className="text-teal hover:underline"
                  >
                    {t.template_name}
                  </Link>
                </td>
                <td className="py-2 capitalize">{t.observation_class}</td>
                <td className="py-2">{formatCadence(t.cadence)}</td>
                <td className="py-2">
                  {t.enabled ? 'Enabled' : 'Disabled'}
                </td>
                <td className="py-2 text-slate">
                  {t.last_run_at
                    ? new Date(t.last_run_at).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
