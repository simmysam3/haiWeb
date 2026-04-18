export const PROVENANCE_ERROR_COPY: Record<string, string> = {
  PROVENANCE_KEY_NOT_FOUND: 'This key no longer exists.',
  PROVENANCE_KEY_REVOKED: 'This key has been revoked. Ask the generator for a new one.',
  PROVENANCE_KEY_EXPIRED: 'This key has expired.',
  PROVENANCE_KEY_DISABLED: 'This key is currently disabled.',
  SHARING_POLICY_MISMATCH: 'Your sharing policy does not cover all required fields.',
  INVALID_REQUESTED_FIELD: 'One or more fields cannot be requested on this key.',
  ALREADY_INSTALLED: 'You already have an active installation of this key.',
  NOT_GENERATOR: 'Only the key generator can perform this action.',
  NOT_INSTALLER: 'Only the installer can modify this installation.',
  INSTALLATION_NOT_FOUND: 'Installation not found.',
  INSTALLATION_REMOVED: 'This installation has been removed.',
};

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

export function mapProvenanceError(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const envelope = (err as { error?: unknown }).error;
    if (envelope && typeof envelope === 'object' && 'code' in envelope) {
      const code = (envelope as { code?: unknown }).code;
      if (typeof code === 'string' && PROVENANCE_ERROR_COPY[code]) {
        return PROVENANCE_ERROR_COPY[code];
      }
    }
  }
  return GENERIC_FALLBACK;
}
