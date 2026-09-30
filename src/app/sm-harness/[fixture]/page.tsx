import { notFound } from 'next/navigation';
import { Harness, type HarnessFixture } from './harness';

/** Never prerendered: the gate reads the server's environment at request time. */
export const dynamic = 'force-dynamic';

const FIXTURES: readonly string[] = ['multitier', 'throttled'];

/**
 * The SP2 browser harness (plan Task 13, spec §12.6): the run workspace on the SP2-0 fixtures with no session and
 * no haiCore, so Playwright can measure it in a real browser. It exists only when the server was started with
 * SM_HARNESS=1; otherwise, and for any other fixture name, it is a 404. Outside proxy.ts's matcher and the gated
 * sourcing-map layout.
 */
export default async function HarnessPage({ params }: { params: Promise<{ fixture: string }> }) {
  if (process.env.SM_HARNESS !== '1') notFound();
  const { fixture } = await params;
  if (!FIXTURES.includes(fixture)) notFound();
  return <Harness fixture={fixture as HarnessFixture} />;
}
