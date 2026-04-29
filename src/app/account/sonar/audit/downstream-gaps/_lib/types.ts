import type { ResolutionClass } from '@haiwave/protocol';

export type OnNetworkStatus = 'participant' | 'invited' | 'not_invited';

export interface DownstreamGapFilters {
  resolution_class?: ResolutionClass[];
  on_network_status?: OnNetworkStatus[];
  min_request_count?: number;
}
