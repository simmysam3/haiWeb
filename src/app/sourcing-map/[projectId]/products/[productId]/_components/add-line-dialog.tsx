'use client';
import { useId, useState, type ReactNode } from 'react';
import type { BomLinePin } from '@haiwave/protocol';
import { newDraftLine, type BomDraftLine } from '@/lib/sourcing-map/bom-draft';
import { SmButton } from '../../../../_components/sm-button';
import { SmDialog } from '../../../../_components/sm-dialog';
import { ClassPicker } from './class-picker';
import { PinEditor } from './pin-editor';

type Picked = { class_id: string; label: string };

/** One numbered step. It is always there to read; a step that waits says what it waits for. */
function Step({ name, waitsFor, children }: { name: string; waitsFor: string | null; children: ReactNode }) {
  return (
    <fieldset role="group" aria-label={name} className="mt-4 first:mt-0">
      <legend className="sm-heading text-sm font-semibold">{name}</legend>
      {waitsFor && <p className="sm-muted text-xs">{waitsFor}</p>}
      <div className={waitsFor ? 'mt-1 opacity-60' : 'mt-1'}>{children}</div>
    </fieldset>
  );
}

/**
 * Add line, asked in order (owner's walk, 2026-09-29): the component, then its class, then a supplier. It fills a
 * new row of the grid, which stays editable in place; nothing is saved until Save BOM.
 */
export function AddLineDialog({ open, onClose, onAdd }: { open: boolean; onClose(): void; onAdd(line: BomDraftLine): void }) {
  const [component, setComponent] = useState('');
  const [partRef, setPartRef] = useState('');
  const [qty, setQty] = useState('1');
  const [uom, setUom] = useState('ea');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pins, setPins] = useState<BomLinePin[]>([]);
  const [later, setLater] = useState(false);
  const [unpinned, setUnpinned] = useState(false);
  const waitId = useId();
  const named = component.trim() !== '' && Number.parseFloat(qty) > 0 && uom.trim() !== '';

  return (
    <SmDialog
      title="Add a BOM line"
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sm-btn sm-btn-ghost" onClick={onClose}>Cancel</button>
          <SmButton
            className="sm-btn sm-btn-primary"
            disabled={!named || !(picked || later) || unpinned}
            aria-describedby={unpinned ? waitId : undefined}
            onClick={() => onAdd({
              ...newDraftLine(),
              component_label: component.trim(), part_ref: partRef.trim() || null, qty_per_unit: Number.parseFloat(qty), uom: uom.trim(),
              class_id: picked?.class_id ?? null, class_label: picked?.label ?? null, pins,
            })}
          >
            Add line
          </SmButton>
        </>
      }
    >
      <Step name="1. Component" waitsFor={null}>
        <label className="block text-sm">
          Component
          <input className="sm-input mt-1 w-full" value={component} maxLength={200} onChange={(e) => setComponent(e.target.value)} />
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="text-sm">
            Qty per unit
            <input type="number" step="any" min={0} className="sm-input mt-1 block w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="text-sm">
            UoM
            <input className="sm-input mt-1 block w-20" value={uom} maxLength={20} onChange={(e) => setUom(e.target.value)} />
          </label>
          <label className="text-sm">
            Part ref
            <input className="sm-input mt-1 block w-32" value={partRef} maxLength={200} onChange={(e) => setPartRef(e.target.value)} />
          </label>
        </div>
      </Step>
      <Step name="2. Class" waitsFor={named ? null : 'Name the component first.'}>
        <ClassPicker label={component.trim() || 'the new line'} value={picked} suggestion={null} onChange={setPicked} locked={!named || later} />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox" checked={later} disabled={!named}
            onChange={(e) => {
              setLater(e.target.checked);
              // Deciding later is deciding on no class: a class picked before, and its suppliers, go.
              if (e.target.checked) {
                setPicked(null);
                setPins([]);
                setUnpinned(false);
              }
            }}
          />
          Decide the class later
        </label>
        {later && <p className="sm-muted text-xs">The line is added as Unclassified. Pick its class in the grid when you know it.</p>}
      </Step>
      <Step name="3. Supplier" waitsFor={picked ? null : later ? 'A supplier is chosen from those who publish the class, so this waits for the class.' : 'Pick a class first.'}>
        {picked && (
          <>
            <p className="sm-muted text-xs">Optional. With no supplier the line is open to any trading partner.</p>
            {/* The grid's own editor, keyed by class: an editor opened for one class must not offer another's publishers. */}
            <PinEditor key={picked.class_id} classId={picked.class_id} pins={pins} onChange={setPins} startOpen onPending={setUnpinned} cancelLabel="Skip supplier" />
            {/* A supplier chosen and not pinned would be lost with the dialog, so Add line waits for it. */}
            {unpinned && <p id={waitId} className="sm-warn mt-1 text-xs">Press Pin to keep the supplier you chose, or Skip supplier.</p>}
          </>
        )}
      </Step>
    </SmDialog>
  );
}
