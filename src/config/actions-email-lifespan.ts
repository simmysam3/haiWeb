/**
 * D-239: lifespan (seconds) of the console team-member invite link (Keycloak
 * execute-actions-email: VERIFY_EMAIL + UPDATE_PASSWORD). Four days, matching the
 * approval link (haiCore config/actions-email-lifespan.ts, D-238), instead of the
 * realm's admin-link default. A constant: there is no env knob in haiWeb.
 */
export const TEAM_INVITE_LIFESPAN_SECONDS = 4 * 24 * 60 * 60;
