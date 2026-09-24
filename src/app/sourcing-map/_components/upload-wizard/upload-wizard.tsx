'use client';
import { useMemo, useState } from 'react';
import type { SmProductDetail, VariantAxis } from '@/lib/sourcing-map/contract';
import { detectHeaderRow, readWorkbookSheets, unreadableDetail, type SheetGrid } from '@/lib/scope-import/parse-workbook';
import { autoMap } from '@/lib/sourcing-map/upload/header-map';
import { buildBomLines, type BomBuild } from '@/lib/sourcing-map/upload/bom-rows';
import type { DemandBuild, DemandBuildProduct } from '@/lib/sourcing-map/upload/demand-rows';
import { SmDialog } from '../sm-dialog';
import { FileStep } from './file-step';
import { MapStep } from './map-step';
import { ResolveStep } from './resolve-step';

export type UploadWizardProps =
  | { kind: 'bom'; productId: string; axis: VariantAxis | null; onCommitted(detail: SmProductDetail): void; onClose(): void }
  | { kind: 'demand'; products: DemandBuildProduct[]; onApply(build: DemandBuild): void; onClose(): void };

type Step = 'file' | 'map' | 'resolve' | 'review';
const STEP_LABELS: Record<Step, string> = { file: 'File', map: 'Map columns', resolve: 'Resolve', review: 'Review' };

/** Spec §7.3: File → Map columns → Resolve (BOM only) → Review. Only mapped rows leave the browser. */
export function UploadWizard(props: UploadWizardProps) {
  const { kind } = props;
  const steps: Step[] = kind === 'bom' ? ['file', 'map', 'resolve', 'review'] : ['file', 'map', 'review'];
  const variantValues = useMemo(
    () => (props.kind === 'bom' ? props.axis?.values ?? [] : [...new Set(props.products.flatMap((p) => p.variant_values))]),
    [props],
  );
  const [step, setStep] = useState<Step>('file');
  const [sheets, setSheets] = useState<SheetGrid[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<string[]>([]);
  const [decimalComma, setDecimalComma] = useState(false);
  const [bom, setBom] = useState<Extract<BomBuild, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function mapFor(all: SheetGrid[], s: number, h: number) {
    const hs = all[s]?.rows[h]?.cells ?? [];
    setMapping(autoMap(kind, hs, variantValues));
  }

  async function onFile(file: File) {
    setError(null);
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch {
      setError(unreadableDetail(file.name));
      return;
    }
    const out = await readWorkbookSheets(bytes, { fileName: file.name });
    if (!out.ok) {
      setError(out.detail);
      return;
    }
    if (out.sheets.length === 0) {
      setError(`${file.name} has no rows.`);
      return;
    }
    const h = detectHeaderRow(out.sheets[0]!);
    setSheets(out.sheets);
    setSheetIndex(0);
    setHeaderIndex(h);
    setDecimalComma(out.decimalComma);
    mapFor(out.sheets, 0, h);
    setStep('map');
  }

  const rows = sheets[sheetIndex]?.rows ?? [];
  const headers = rows[headerIndex]?.cells ?? [];
  const dataRows = rows.slice(headerIndex + 1);

  function onContinueMap() {
    setError(null);
    if (props.kind !== 'bom') return; // Cycle 32.7 adds the demand path
    const out = buildBomLines({ rows: dataRows, headers, mapping, variantValues, decimalComma });
    if (!out.ok) {
      setError(out.rejection);
      return;
    }
    const mappingErrors = out.errors.filter((e) => e.row === 0);
    if (mappingErrors.length > 0) {
      setError(mappingErrors.map((e) => e.message).join(' '));
      return;
    }
    setBom(out);
    setStep('resolve');
  }

  const title = kind === 'bom' ? 'Upload BOM' : 'Upload schedule';
  // The modal shell (backdrop, labelled dialog, Escape, focus in / trap / return) is SmDialog's (controller ruling, I07).
  return (
    <SmDialog open title={title} onClose={props.onClose}>
      <div className="flex items-center justify-between gap-4">
        <ol aria-label="Upload steps" className="flex gap-4 text-xs">
          {steps.map((s, i) => (
            <li key={s} aria-current={s === step ? 'step' : undefined} className={s === step ? 'font-semibold' : 'sm-muted'}>
              {`${i + 1} ${STEP_LABELS[s]}`}
            </li>
          ))}
        </ol>
        <button type="button" className="sm-btn sm-btn-ghost text-xs" onClick={props.onClose}>Close</button>
      </div>
      <div className="mt-4">
        {step === 'file' && <FileStep onFile={(f) => void onFile(f)} error={error} />}
        {step === 'map' && (
          <MapStep
            kind={kind}
            sheets={sheets}
            sheetIndex={sheetIndex}
            headerIndex={headerIndex}
            mapping={mapping}
            onSheet={(i) => {
              const h = detectHeaderRow(sheets[i]!);
              setSheetIndex(i);
              setHeaderIndex(h);
              mapFor(sheets, i, h);
            }}
            onHeader={(h) => {
              setHeaderIndex(h);
              mapFor(sheets, sheetIndex, h);
            }}
            onMapping={setMapping}
            onBack={() => setStep('file')}
            onContinue={onContinueMap}
            error={error}
          />
        )}
        {step === 'resolve' && bom && <ResolveStep lines={bom.lines} />}
      </div>
    </SmDialog>
  );
}
