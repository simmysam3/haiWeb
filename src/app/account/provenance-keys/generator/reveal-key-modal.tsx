'use client';

import { Modal } from '@/components/modal';

export interface RevealKeyModalProps {
  open: boolean;
  onClose: () => void;
  keyId?: string;
  keyValue?: string;
}

export function RevealKeyModal({ open, onClose }: RevealKeyModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Key Value">
      <p className="text-sm text-slate">Reveal modal — implemented in Task 26.</p>
    </Modal>
  );
}
