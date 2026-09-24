import { formatQty } from '@/lib/sourcing-map/map/selectors';

export interface SeatInfo {
  name: string;
  country: string | null;
  classLabel: string | null;
  productCount: number;
  slotCount: number;
  assemblyDays: string;
  capacity: number | null;
}

/** The seat (spec §9.3): name, country and class from the result's seat block (d-G6). */
export function SeatCard({ seat }: { seat: SeatInfo }) {
  const where = [seat.country, seat.classLabel].filter((x): x is string => x !== null).join(' · ');
  return (
    <div className="sm-card h-full p-4 text-sm">
      <p className="sm-muted text-xs">Seat</p>
      <p className="sm-heading text-base font-semibold">{seat.name}</p>
      {where && <p className="sm-muted">{where}</p>}
      <p className="mt-2">{`${seat.productCount} products · ${seat.slotCount} slots`}</p>
      <p className="sm-muted mt-1">{`Assembly ${seat.assemblyDays} d`}</p>
      <p className="sm-muted">{seat.capacity !== null ? `${formatQty(seat.capacity)} units per week` : 'Assembly capacity not set'}</p>
    </div>
  );
}
