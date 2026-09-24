'use client';
import type { ComponentProps } from 'react';

/**
 * LW-a (WCAG 2.4.3, AC 2): the button a user pressed keeps keyboard focus while its own request runs. A `disabled`
 * button loses focus to <body> (HTML's focus-fixup rule), so while `busy` this renders aria-disabled and aria-busy
 * instead, and ignores presses. A control disabled for a reason (not ready, nothing to save, invalid input) keeps
 * `disabled`.
 */
export function SmButton({ busy = false, onClick, ...rest }: Omit<ComponentProps<'button'>, 'type'> & { busy?: boolean }) {
  return <button {...rest} type="button" aria-disabled={busy || undefined} aria-busy={busy || undefined} onClick={busy ? undefined : onClick} />;
}
