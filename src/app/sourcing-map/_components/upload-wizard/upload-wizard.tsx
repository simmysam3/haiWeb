'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SmProductDetail, VariantAxis } from '@/lib/sourcing-map/contract';
import {
  detectHeaderRow, MAX_IMPORT_BYTES, readWorkbookSheets, tooLargeDetail, unreadableDetail, type SheetGrid,
} from '@/lib/scope-import/parse-workbook';
import { autoMap, recallMapping, rememberMapping } from '@/lib/sourcing-map/upload/header-map';
import { buildBomLines, type BomBuild } from '@/lib/sourcing-map/upload/bom-rows';
import type { DemandBuild, DemandBuildProduct } from '@/lib/sourcing-map/upload/demand-rows';
import { toUploadInput, type ResolvedLine } from '@/lib/sourcing-map/upload/resolve';
import { smFetch } from '@/lib/sourcing-map/client';
import { SmDialog } from '../sm-dialog';
import { FileStep } from './file-step';
import { MapStep } from './map-step';
import { ResolveStep } from './resolve-step';
import { ReviewStep } from './review-step';

export type UploadWizardProps =
  | { kind: 'bom'; productId: string; axis: VariantAxis | null; onCommitted(detail: SmProductDetail): void; onClose(): void }
  | { kind: 'demand'; products: DemandBuildProduct[]; onApply(build: DemandBuild): void; onClose(): void };

type Step = 'file' | 'map' | 'resolve' | 'review';
const STEP_LABELS: Record<Step, string> = { file: 'File', map: 'Map columns', resolve: 'Resolve', review: 'Review' };

function bomSummary(lines: ResolvedLine[]): string[] {
  const classified = lines.filter((l) => l.class_id !== null).length;
  const pinned = lines.filter((l) => l.pin !== null).length;
  const unclassified = lines.length - classified;
  const out = [`${lines.length} line${lines.length === 1 ? '' : 's'} · ${classified} classified · ${pinned} pinned`];
  if (unclassified > 0) out.push(`${unclassified} line${unclassified === 1 ? ' has' : 's have'} no class yet; Run stays disabled until every line has one.`);
  return out;
}

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
  const [resolved, setResolved] = useState<ResolvedLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A step change unmounts the control that had focus (the file input, Continue, Back), which drops
  // focus to <body>, outside SmDialog's Tab trap. Move it to the new step's container instead. Keyed
  // on `step` itself, so every transition gets it; the mount (SmDialog's own initial focus) does not.
  const stepRef = useRef<HTMLDivElement | null>(null);
  const shownStep = useRef<Step>(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    stepRef.current?.focus();
  }, [step]);

  function mapFor(all: SheetGrid[], s: number, h: number) {
    const hs = all[s]?.rows[h]?.cells ?? [];
    setMapping(recallMapping(kind, hs) ?? autoMap(kind, hs, variantValues));
  }

  async function onFile(file: File) {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(tooLargeDetail(file.name, file.size));
      return;
    }
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
    // The reader keeps a sheet with no non-blank rows (rows: []), so an empty file has sheets, all empty.
    if (out.sheets.every((s) => s.rows.length === 0)) {
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
    // Nothing under the header would reach Review as "Save 0 lines" and replace the BOM with an empty one.
    if (dataRows.length === 0) {
      setError(`There are no rows under the header row (Row ${rows[headerIndex]?.row ?? headerIndex + 1}).`);
      return;
    }
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
    rememberMapping('bom', headers, mapping);
    setBom(out);
    setStep('resolve');
  }

  async function commitBom() {
    if (props.kind !== 'bom') return;
    setBusy(true);
    setError(null);
    // The mapped rows as JSON — never the file (spec §5.2, §7.3).
    const out = await smFetch<SmProductDetail>(`/api/account/sourcing-map/products/${props.productId}/bom-lines`, {
      method: 'PUT',
      body: { lines: resolved.map(toUploadInput) },
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    props.onCommitted(out.data);
  }

  const title = kind === 'bom' ? 'Upload BOM' : 'Upload schedule';
  // The modal shell (backdrop, labelled dialog, Escape, focus in / trap / return) is SmDialog's (controller ruling, I07).
  return (
    <SmDialog open wide title={title} onClose={props.onClose}>
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
      <div ref={stepRef} role="group" aria-label={STEP_LABELS[step]} tabIndex={-1} className="mt-4 outline-none">
        {step === 'file' && <FileStep onFile={(f) => void onFile(f)} error={error} />}
        {step === 'map' && (
          <MapStep
            kind={kind}
            sheets={sheets}
            sheetIndex={sheetIndex}
            headerIndex={headerIndex}
            mapping={mapping}
            onSheet={(i) => {
              setError(null); // another sheet: the old error named the old sheet's columns and rows
              const h = detectHeaderRow(sheets[i]!);
              setSheetIndex(i);
              setHeaderIndex(h);
              mapFor(sheets, i, h);
            }}
            onHeader={(h) => {
              setError(null); // a new header row means new columns and data rows; the old error named the old ones
              setHeaderIndex(h);
              mapFor(sheets, sheetIndex, h);
            }}
            onMapping={setMapping}
            onBack={() => {
              setError(null); // the error answered this step's Continue; the File step never shows it
              setStep('file');
            }}
            onContinue={onContinueMap}
            error={error}
          />
        )}
        {step === 'resolve' && bom && <ResolveStep lines={bom.lines} onBack={() => setStep('map')} onContinue={(r) => { setResolved(r); setStep('review'); }} />}
        {step === 'review' && props.kind === 'bom' && bom && (
          <ReviewStep
            summary={bomSummary(resolved)}
            errors={bom.errors}
            ignoredColumns={bom.ignoredColumns}
            commitLabel={`Save ${resolved.length} line${resolved.length === 1 ? '' : 's'}`}
            busy={busy}
            error={error}
            onBack={() => setStep('resolve')}
            onCommit={() => void commitBom()}
          />
        )}
      </div>
    </SmDialog>
  );
}
