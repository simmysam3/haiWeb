"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = "max-w-md" }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl border border-slate/15 shadow-xl ${width} w-full mx-4`}>
        <div className="flex items-center justify-between p-6 border-b border-slate/15">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate hover:text-charcoal transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
