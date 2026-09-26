// Test helper for focus that must be right at every moment a user could observe it (F-FLAKE-1); not a test file itself.

/**
 * Records `document.activeElement` as the page stands once `settled()` first holds after a DOM change: at the end of
 * that change's own microtasks, before any later task (a paint, a key press, React's deferred passive effects) can run.
 * A `waitFor` on the same change followed by a focus read instead races React's passive-effect task (F-FLAKE-1).
 */
export function recordFocusWhen(settled: () => boolean): { readonly element: Element | null | undefined } {
  const record: { element: Element | null | undefined } = { element: undefined };
  const observer = new MutationObserver(() => {
    if (!settled()) return;
    observer.disconnect();
    queueMicrotask(() => {
      record.element = document.activeElement;
    });
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  return record;
}
