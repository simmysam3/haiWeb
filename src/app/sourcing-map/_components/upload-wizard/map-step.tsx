'use client';
import type { SheetGrid } from '@/lib/scope-import/parse-workbook';
import { BOM_TARGETS, DEMAND_TARGETS, TARGET_LABELS, type UploadKind } from '@/lib/sourcing-map/upload/header-map';

export function MapStep(props: {
  kind: UploadKind; sheets: SheetGrid[]; sheetIndex: number; headerIndex: number; mapping: string[];
  onSheet(i: number): void; onHeader(i: number): void; onMapping(m: string[]): void; onBack(): void; onContinue(): void; error: string | null;
}) {
  const { kind, sheets, sheetIndex, headerIndex, mapping } = props;
  const sheet = sheets[sheetIndex]!;
  const headers = sheet.rows[headerIndex]?.cells ?? [];
  const sample = sheet.rows[headerIndex + 1]?.cells ?? [];
  const targets: readonly string[] = kind === 'bom' ? BOM_TARGETS : DEMAND_TARGETS;
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-sm">
        {sheets.length > 1 && (
          <label>
            Sheet
            <select aria-label="Sheet" className="sm-input ml-2" value={sheetIndex} onChange={(e) => props.onSheet(Number(e.target.value))}>
              {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Header row
          <select aria-label="Header row" className="sm-input ml-2" value={headerIndex} onChange={(e) => props.onHeader(Number(e.target.value))}>
            {sheet.rows.slice(0, 10).map((r, i) => (
              <option key={r.row} value={i}>{`Row ${r.row}: ${r.cells.filter((c) => c.trim() !== '').slice(0, 3).join(' · ')}`}</option>
            ))}
          </select>
        </label>
      </div>
      <table className="sm-table mt-3">
        <thead><tr><th>Your column</th><th>Maps to</th><th>Sample</th></tr></thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={`${i}-${h}`}>
              <td>{h.trim() || `Column ${i + 1}`}</td>
              <td>
                <select
                  aria-label={`Map column ${h.trim() || i + 1}`}
                  className="sm-input"
                  value={mapping[i] ?? 'ignore'}
                  onChange={(e) => props.onMapping(headers.map((_, j) => (j === i ? e.target.value : mapping[j] ?? 'ignore')))}
                >
                  {targets.map((t) => <option key={t} value={t}>{TARGET_LABELS[t]}</option>)}
                </select>
              </td>
              <td className="sm-muted">{sample[i] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.error && <p role="alert" className="sm-error mt-3 text-sm">{props.error}</p>}
      <div className="mt-4 flex justify-between">
        <button type="button" className="sm-btn sm-btn-ghost" onClick={props.onBack}>Back</button>
        <button type="button" className="sm-btn sm-btn-primary" onClick={props.onContinue}>Continue</button>
      </div>
    </div>
  );
}
