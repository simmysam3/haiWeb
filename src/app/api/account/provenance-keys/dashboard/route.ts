import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { HaiwaveClient } from '@/lib/haiwave-api';

function sum<T>(arr: readonly T[], pick: (t: T) => number): number {
  return arr.reduce((acc, x) => acc + pick(x), 0);
}

export const GET = withHaiCore(async ({ client }: { client: HaiwaveClient }) => {
  const [generated, installations, sharingPolicy] = await Promise.all([
    client.listGeneratedKeys(),
    client.listMyInstallations(),
    client.getSharingPolicy(),
  ]);

  const aggregateCounts = {
    generatorActiveCompliant: sum(generated, (k) => k.active_compliant ?? 0),
    generatorActiveGracePending: sum(generated, (k) => k.active_grace_pending ?? 0),
    generatorActiveNonCompliant: sum(generated, (k) => k.active_non_compliant ?? 0),
    installerGracePending: installations.filter((i) => i.compliance?.status === 'grace_pending').length,
    installerNonCompliant: installations.filter((i) => i.compliance?.status === 'non_compliant').length,
  };

  return NextResponse.json({
    generated,
    installations,
    sharingPolicy,
    aggregateCounts,
  });
});
