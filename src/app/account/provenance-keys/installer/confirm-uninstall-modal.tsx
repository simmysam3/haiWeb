'use client';

import { Modal } from '@/components/modal';

export interface ConfirmUninstallModalProps {
  installationId: string;
  open: boolean;
  onClose: () => void;
  onUninstalled: () => void;
}

export function ConfirmUninstallModal({ open, onClose }: ConfirmUninstallModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Uninstall Key">
      <p className="text-sm text-slate">Uninstall modal — implemented in Task 28.</p>
    </Modal>
  );
}
