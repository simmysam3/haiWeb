/**
 * D-239: lifespan (seconds) of the console team-member invite link (Keycloak
 * execute-actions-email, carrying TEAM_INVITE_ACTIONS). Four days, matching the
 * approval link (haiCore config/actions-email-lifespan.ts, D-238), instead of the
 * realm's admin-link default. A constant: there is no env knob in haiWeb.
 */
export const TEAM_INVITE_LIFESPAN_SECONDS = 4 * 24 * 60 * 60;

/**
 * What the invite link asks a new team member to do: prove the mailbox, set a
 * password, and set up an authenticator app, as an account's first user is
 * asked to. One list, so every sender of the invite asks for the same.
 */
export const TEAM_INVITE_ACTIONS: readonly string[] = ["VERIFY_EMAIL", "UPDATE_PASSWORD", "CONFIGURE_TOTP"];
