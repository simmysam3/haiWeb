type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

/**
 * User-facing noun for a saved Sonar configuration, per modality.
 *
 * These are configurations a user initiates and may re-run — not reusable
 * "templates" in the component sense — so single-modality surfaces use a
 * concrete per-modality noun. Genuinely mixed / cross-modality surfaces
 * (the unified list, dashboard roll-ups) should use the neutral
 * "Configuration" / "Configurations" wording instead of this helper.
 */
export function configNoun(observationClass: ObservationClass): string {
  switch (observationClass) {
    case 'phantom_demand':
      return 'Demand Request';
    case 'watcher':
      return 'Watch';
    case 'audit':
      return 'Audit';
  }
}
