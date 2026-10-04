'use client';
import { SmButton } from '@/app/sourcing-map/_components/sm-button';

/**
 * The map's tool row (LF spec §6.4, §6.8): the first thing in the map section after its caption. A group, not a
 * toolbar: that role promises the arrow-key pattern, which this row does not build.
 * Hide all paths is unavailable, never `disabled`, with nothing open (w3): it stays focusable and ignores a press, so
 * the press that closes the last path leaves focus on it.
 */
export function MapToolbar({ pathsOpen, onHideAll }: { pathsOpen: boolean; onHideAll(): void; unavailable: string | null }) {
  return (
    <div role="group" aria-label="Map tools" className="flex flex-wrap items-center gap-2 px-6 pt-3">
      <SmButton title="Closes every open path and trace (Esc)" aria-disabled={!pathsOpen} className="sm-btn sm-btn-ghost text-xs" onClick={onHideAll}>Hide all paths</SmButton>
    </div>
  );
}
