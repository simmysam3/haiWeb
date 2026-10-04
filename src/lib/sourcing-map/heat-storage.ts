/** Per-viewer convenience (spec §6.6). */
export const SM_HEAT_KEY = 'sm.heat';

export function writeStoredHeat(on: boolean): void {
  try {
    window.localStorage.setItem(SM_HEAT_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered; the switch still works for this page view.
  }
}

/** On unless the stored value is exactly 'off': a stale, garbled or unreadable value never hides the heat. */
export function readStoredHeat(): boolean {
  try {
    return window.localStorage.getItem(SM_HEAT_KEY) !== 'off';
  } catch {
    return true;
  }
}
