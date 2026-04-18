'use client';

import { Modal } from '@/components/modal';

export interface GenerateKeyModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: (result: { key: { key_id: string }; key_value: string }) => void;
}

export function GenerateKeyModal({ open, onClose }: GenerateKeyModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Generate Key">
      <p className="text-sm text-slate">Generate modal — implemented in Task 26.</p>
    </Modal>
  );
}
