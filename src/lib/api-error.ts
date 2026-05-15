/**
 * Derive a user-facing message from a failed BFF/haiCore Response.
 *
 * The BFF (`withHaiCore`) and haiCore speak several error shapes:
 *  - haiCore envelope:      { error: { code, message, details } }  (details = Zod issues)
 *  - BFF auth/short-circuit: { error: "Unauthorized" | "No token" | string }
 *  - opaque / non-JSON:     proxy or framework error pages
 *
 * Callers previously collapsed all of this to `"<verb> failed (<status>)"`,
 * which is why an expired session and a bad UUID looked identical. This
 * normalizes them and flags the auth case so the UI can offer re-login.
 */
export interface ApiErrorInfo {
  status: number;
  /** Human-readable, user-facing message. */
  message: string;
  /** True when the failure is an expired/missing auth session (HTTP 401). */
  sessionExpired: boolean;
}

const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again.';

interface ZodIssueLike {
  path?: unknown;
  message?: unknown;
}

function summarizeZodIssues(details: unknown): string {
  if (!Array.isArray(details)) return '';
  return details
    .filter((d): d is ZodIssueLike => !!d && typeof d === 'object')
    .slice(0, 3)
    .map((d) => {
      const path = Array.isArray(d.path) ? d.path.join('.') : '';
      const msg = typeof d.message === 'string' ? d.message : 'invalid';
      return path ? `${path}: ${msg}` : msg;
    })
    .join('; ');
}

export async function describeApiError(res: Response): Promise<ApiErrorInfo> {
  const sessionExpired = res.status === 401;

  let body: unknown = null;
  try {
    body = await res.clone().json();
  } catch {
    body = null;
  }

  let message = '';
  const envelope =
    body && typeof body === 'object'
      ? (body as { error?: unknown }).error
      : undefined;

  if (envelope && typeof envelope === 'object') {
    const e = envelope as { message?: unknown; details?: unknown };
    if (typeof e.message === 'string' && e.message) message = e.message;
    const fieldHints = summarizeZodIssues(e.details);
    if (fieldHints) message = message ? `${message} — ${fieldHints}` : fieldHints;
  } else if (typeof envelope === 'string' && envelope) {
    message = envelope;
  } else if (
    body &&
    typeof body === 'object' &&
    typeof (body as { message?: unknown }).message === 'string'
  ) {
    message = (body as { message: string }).message;
  }

  if (sessionExpired) {
    message = SESSION_EXPIRED_MESSAGE;
  } else if (!message) {
    message =
      res.status === 403
        ? 'You do not have permission to do that.'
        : `Request failed (${res.status}).`;
  }

  return { status: res.status, message, sessionExpired };
}
