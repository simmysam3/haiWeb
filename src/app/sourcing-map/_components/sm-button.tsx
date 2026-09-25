'use client';
import type { ComponentProps } from 'react';

/**
 * LW-a (WCAG 2.4.3, AC 2): the button a user pressed keeps keyboard focus while its own request runs. A `disabled`
 * button loses focus to <body> (HTML's focus-fixup rule), so while `busy` this renders aria-disabled and aria-busy
 * instead, and ignores presses. A control disabled for a reason (not ready, nothing to save, invalid input) keeps
 * `disabled`. An explicit `aria-disabled` is inert the same way; Run uses it for its reasons, each of which it
 * describes through aria-describedby, so focus stays on Run when it turns to "An execution is running.".
 */
export function SmButton({ busy = false, onClick, 'aria-disabled': ariaDisabled, ...rest }: Omit<ComponentProps<'button'>, 'type'> & { busy?: boolean }) {
  const inert = busy || ariaDisabled === true || ariaDisabled === 'true';
  return <button {...rest} type="button" aria-disabled={inert || undefined} aria-busy={busy || undefined} onClick={inert ? undefined : onClick} />;
}
