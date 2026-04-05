"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const DEFAULT_DURATION_MS = 3000;

/**
 * Minimal toast state hook. Returns the current message (or "") and a
 * showToast callback that sets it for `durationMs` then clears it.
 * Consolidates the identical pattern that was previously duplicated across
 * ~10 panel components.
 */
export function useToast(durationMs: number = DEFAULT_DURATION_MS) {
  const [toast, setToast] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(""), durationMs);
  }, [durationMs]);

  // Clear pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast };
}
