'use client';

import { useLayoutEffect } from 'react';

/**
 * R-9: time render to commit as one measure named `name`; the SP1-e walk reads it in a real browser.
 * The map-canvas idiom with both clears: the render clears the previous start mark (StrictMode re-runs
 * the layout effect without a re-render, sibling instances share the name) and the effect clears the
 * previous measure, so exactly one of each is left however often it renders.
 */
export function useRenderMeasure(name: string): void {
  const mark = `${name}-start`;
  performance.clearMarks(mark);
  performance.mark(mark);
  useLayoutEffect(() => {
    performance.clearMeasures(name);
    performance.measure(name, mark);
  });
}
