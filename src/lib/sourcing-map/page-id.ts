import { notFound } from 'next/navigation';
import { UUID } from './bff';

/**
 * A page's route segment bound into a BFF path (agent5 audit M2). Next hands a page its params decoded, so a
 * crafted `..%2F` segment arrives as `../` and would walk the BFF path above its route. Every Sourcing Map id
 * is a uuid; anything else is a 404 before any fetch.
 */
export function smPageId(v: string): string {
  if (!UUID.test(v)) notFound();
  return v;
}
