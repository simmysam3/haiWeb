'use client';

import { Modal } from '@/components/modal';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

export interface ConfirmRevokeModalProps {
  keyRow: ProvenanceKeyWithCounts;
  open: boolean;
  onClose: () => void;
  onRevoked: () => void;
}

export function ConfirmRevokeModal({ open, onClose }: ConfirmRevokeModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Revoke Key">
      <p className="text-sm text-slate">Revoke modal — implemented in Task 26.</p>
    </Modal>
  );
}
