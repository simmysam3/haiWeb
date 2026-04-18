'use client';

import { Modal } from '@/components/modal';
import type { ProvenanceKeyWithCounts, ProvenanceKeyInstallation } from '@haiwave/protocol';

export interface EditPermissionsModalProps {
  keyRow: ProvenanceKeyWithCounts;
  installations: ProvenanceKeyInstallation[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPermissionsModal({ open, onClose }: EditPermissionsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Edit Permissions">
      <p className="text-sm text-slate">Edit permissions modal — implemented in Task 26.</p>
    </Modal>
  );
}
