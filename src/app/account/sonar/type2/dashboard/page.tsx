import { PageHeader } from '@/components/page-header';
import { Type2Dashboard } from './_components/type2-dashboard';

/**
 * v1.28 Phase 5 — Type 2 (continuous observation) dashboard surface.
 *
 * Shows the caller's run history, the latest snapshot per counterparty
 * (lead time / capacity / delivery), and a button to trigger a new sweep.
 * Spec §8.6.
 */
export default function Type2DashboardPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Type 2 — Continuous observation"
        description="Lead time, capacity, and delivery signals across your tier-1 trading partners."
      />
      <Type2Dashboard />
    </div>
  );
}
