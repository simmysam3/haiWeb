import { notFound } from 'next/navigation';
import { Harness, type HarnessFixture } from './harness';

/** Never prerendered: the gate reads the server's environment at request time. */
export const dynamic = 'force-dynamic';

const FIXTURES: readonly string[] = ['multitier', 'throttled', 'not-traced', 'supply-risks', 'demand-exceptions'];

/**
 * The browser harness (SP2 plan Task 13, SP3-d Task 12; spec §12.6): the run workspace on the SP2-0 fixtures, the not-traced variant, and the two backlog tables on the SP3 fixtures with no session and
 * no haiCore, so Playwright can measure it in a real browser. It exists only when the server was started with
 * SM_HARNESS=1; otherwise, and for any other fixture name, it is a 404. Outside proxy.ts's matcher and the gated
 * sourcing-map layout. A production server answers 404 even with SM_HARNESS=1 (M-5): the harness runs under `next dev`.
 */
export default async function HarnessPage({ params }: { params: Promise<{ fixture: string }> }) {
  if (process.env.SM_HARNESS !== '1' || process.env.NODE_ENV === 'production') notFound();
  const { fixture } = await params;
  if (!FIXTURES.includes(fixture)) notFound();
  return <Harness fixture={fixture as HarnessFixture} />;
}
