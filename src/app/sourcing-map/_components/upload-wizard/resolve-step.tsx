'use client';
import type { UploadedBomLine } from '@/lib/sourcing-map/upload/bom-rows';

/** A first, static Resolve step; Task 32 completes it. */
export function ResolveStep({ lines }: { lines: UploadedBomLine[] }) {
  return (
    <div>
      <button type="button" className="sm-btn sm-btn-ghost">Accept all confident</button>
      <table className="sm-table mt-3">
        <tbody>
          {lines.map((l) => (
            <tr key={l.key}>
              <td>
                {l.component_label}
                {l.class_text && <p className="sm-muted text-xs">File says: {l.class_text}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
