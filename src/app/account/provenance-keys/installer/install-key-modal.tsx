'use client';

import { Modal } from '@/components/modal';

export interface InstallKeyModalProps {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

export function InstallKeyModal({ open, onClose }: InstallKeyModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Install Key">
      <p className="text-sm text-slate">Install modal — implemented in Task 28.</p>
    </Modal>
  );
}
