'use client';

import Link from 'next/link';
import type { CounterpartyRow } from './types';

interface Props { rows: CounterpartyRow[]; }

export function CounterpartyTable({ rows }: Props) {
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Counterparty breakdown</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate mt-2">No counterparty activity yet.</p>
      ) : (
        <table className="w-full mt-2 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate">
              <th className="py-2">Counterparty</th>
              <th className="py-2">Total hops</th>
              <th className="py-2">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.counterparty_id} className="border-b border-slate-100">
                <td className="py-2">
                  <Link href={`/account/partners/${r.counterparty_id}`} className="text-teal hover:underline">
                    {r.counterparty_name ?? r.counterparty_id}
                  </Link>
                </td>
                <td className="py-2">{r.total_hops.toLocaleString()}</td>
                <td className="py-2 text-slate">{new Date(r.last_activity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
