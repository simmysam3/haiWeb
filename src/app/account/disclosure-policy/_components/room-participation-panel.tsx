'use client';

import type { AttributeClassSummary, RoomParticipationState } from '@/lib/safe-room-types';

interface Props {
  classes: AttributeClassSummary[];
  participation: RoomParticipationState;
  onToggleParticipation: (attributeClassId: string | null, enabled: boolean) => void;
}

export function RoomParticipationPanel({ classes, participation, onToggleParticipation }: Props) {
  const globalEnabled = participation.global;

  return (
    <div className="mt-8 space-y-4">
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" aria-label="Participate in the evaluation room (all classes)" checked={globalEnabled} onChange={(e) => onToggleParticipation(null, e.target.checked)} />
        Participate in the evaluation room (all classes)
      </label>
      <ul className="space-y-2">
        {classes.map((c) => {
          const enabled = participation.per_class[c.attribute_class_id] ?? globalEnabled;
          return (
            <li key={c.attribute_class_id} className="flex items-center gap-6 text-sm text-charcoal">
              <label className="flex items-center gap-2">
                <input type="checkbox" aria-label={`Participate in the evaluation room for ${c.display_name}`} checked={enabled} onChange={(e) => onToggleParticipation(c.attribute_class_id, e.target.checked)} />
                {c.display_name}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
