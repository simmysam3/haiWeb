import { redirect } from 'next/navigation';

/**
 * v.1.41: `/account/sonar/templates` (the list page) is retiring. Each
 * observation_class now has its own home where configs are managed in
 * context:
 *
 *   - audit          → /account/sonar/audit            (already moved earlier)
 *   - watcher        → /account/sonar/posture/runs     (becomes /sonar/watchers
 *                                                       once PR #71 lands;
 *                                                       PR-B will flip this)
 *   - phantom_demand → /account/sonar/observations     (still placeholder;
 *                                                       PR-B may flip once
 *                                                       phantom_demand graduates)
 *
 * This server component dispatches by `?observation_class=…` and 307-redirects
 * to the appropriate home. With no class param, default to the watcher home
 * (the primary near-term config surface).
 *
 * The form (`/templates/new`) and detail (`/templates/[id]`) routes are
 * intentionally NOT touched — many consumers reference them and they're the
 * actual config CRUD plumbing.
 */

const TARGETS = {
  audit: '/account/sonar/audit',
  watcher: '/account/sonar/posture/runs',
  phantom_demand: '/account/sonar/observations',
} as const;
type Class = keyof typeof TARGETS;

function isClass(v: string | undefined): v is Class {
  return v === 'audit' || v === 'watcher' || v === 'phantom_demand';
}

interface PageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

export default async function TemplatesRedirect({ searchParams }: PageProps) {
  const { observation_class } = await searchParams;
  const target = isClass(observation_class)
    ? TARGETS[observation_class]
    : TARGETS.watcher;
  redirect(target);
}
