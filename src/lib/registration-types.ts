// The haiCore registration admin contract. Row/detail shapes are the single
// source of truth in @haiwave/protocol (packages/protocol/src/registration/);
// re-exported here as types so a protocol change breaks the build instead of
// silently diverging. snake_case JSON over the admin API.

export type {
  RiskTier,
  RegistrationStatus,
  RegistrationListItem,
  RegistrationDetail,
} from '@haiwave/protocol';

/** 409 body when a blocked-tier request is approved without an override. */
export const BLOCKED_REQUIRES_OVERRIDE = 'blocked_requires_override' as const;
