import type { Cadence } from '@haiwave/protocol';

const DAY_FULL: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const EVENT_LABELS: Record<string, string> = {
  new_trading_partner_added: 'New trading partner added',
  partner_trust_class_changed: 'Partner trust class changed',
};

export function formatCadence(cadence: Cadence): string {
  switch (cadence.kind) {
    case 'manual_only':
      return 'Manual only';
    case 'daily':
      return `Daily at ${cadence.time_of_day} UTC`;
    case 'weekly':
      return `Weekly on ${DAY_FULL[cadence.day_of_week]} at ${cadence.time_of_day} UTC`;
    case 'monthly':
      return `Monthly on day ${cadence.day_of_month} at ${cadence.time_of_day} UTC`;
    case 'event_triggered':
      return `On event: ${EVENT_LABELS[cadence.event_type] ?? cadence.event_type}`;
  }
}
