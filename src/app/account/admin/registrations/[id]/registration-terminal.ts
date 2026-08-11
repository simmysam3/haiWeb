import type { RegistrationStatus } from '@/lib/registration-types';

// Exhaustive on purpose: a 4th RegistrationStatus member fails the build here
// instead of silently passing the old `status !== 'pending_approval'` chain.
export const REGISTRATION_TERMINAL: Record<RegistrationStatus, boolean> = {
  pending_approval: false,
  approved: true,
  rejected: true,
};
