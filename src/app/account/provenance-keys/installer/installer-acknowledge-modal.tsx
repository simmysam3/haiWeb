'use client';

import { Modal } from '@/components/modal';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

export interface InstallerAcknowledgeModalProps {
  installation: ProvenanceKeyInstallation;
  sharingPolicy: SharingPolicy;
  open: boolean;
  onClose: () => void;
  onAcknowledged: () => void;
}

export function InstallerAcknowledgeModal({ open, onClose }: InstallerAcknowledgeModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Review & Acknowledge">
      <p className="text-sm text-slate">Acknowledge modal — implemented in Task 28.</p>
    </Modal>
  );
}
