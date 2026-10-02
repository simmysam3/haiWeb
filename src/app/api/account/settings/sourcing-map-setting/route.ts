import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** The participant comes from the session only, never the query or the body. */
const settingPath = (participantId: string) => `/participants/${encodeURIComponent(participantId)}/sourcing-map-setting`;

export const GET = withHaiCore(
  ({ client, request, session }) => smForward(client, request, settingPath(session.participant.id)),
  { role: 'account_admin' },
);

export const PUT = withHaiCore(
  ({ client, request, session }) => smForward(client, request, settingPath(session.participant.id)),
  { role: 'account_admin' },
);
