'use client';
import Link from 'next/link';
import type { SmProduct } from '@/lib/sourcing-map/contract';
import { smProductHref } from '@/lib/sourcing-map/routes';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

/** The Product library tab (spec §7.1). Cycles 22.7 and 22.8 add create and delete. */
export function LibraryTab({ projectId, initialProducts }: { projectId: string; initialProducts: SmProduct[] }) {
  return (
    <div>
      <table className="sm-table">
        <thead>
          <tr><th>Product</th><th>Source</th><th>Variants</th><th>Lines</th><th>Ready</th></tr>
        </thead>
        <tbody>
          {initialProducts.map((p) => (
            <tr key={p.product_id} aria-label={p.name}>
              <td>
                <Link href={smProductHref(projectId, p.product_id)} aria-label={`Open ${p.name}`} className="group inline-flex items-center gap-2">
                  {p.name}
                  <DetailChevron />
                </Link>
              </td>
              <td><Pill themed category="sm_bom_source" value={p.bom_source} /></td>
              <td>{p.variant_axis ? `${p.variant_axis.values.length} · ${p.variant_axis.system ?? p.variant_axis.name}` : '—'}</td>
              <td>{p.line_count}</td>
              <td>
                <Pill themed category="sm_readiness" value={p.readiness.ready ? 'ready' : 'not_ready'} detail={p.readiness.detail} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
