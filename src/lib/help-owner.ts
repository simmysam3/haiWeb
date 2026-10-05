import { createHash } from "node:crypto";
import type { Session } from "@/lib/auth";

/**
 * The owner of the stored HAIWAVE Help panel state (amendment P3-7): the
 * lowercase hex SHA-256 of `<participant id>:<user id>`, so the next user who
 * signs in in the same tab never restores this user's panel. An ownership tag,
 * not a secret. Null without a session or a user id: such a panel stores nothing.
 *
 * SERVER-ONLY (node:crypto): the account and sourcing-map layouts call it and
 * hand the result to `HelpProvider`. Never import it from a 'use client' file.
 */
export function helpOwnerKey(session: Session | null): string | null {
  if (!session || !session.user.id) return null;
  return createHash("sha256").update(`${session.participant.id}:${session.user.id}`).digest("hex");
}
