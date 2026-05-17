import Link from 'next/link';

interface FormErrorProps {
  /** User-facing message (already humanized — see lib/api-error.ts). */
  message: string;
  /**
   * When true, the failure was an expired/missing auth session; render a
   * direct re-login affordance instead of leaving the user stuck.
   */
  sessionExpired?: boolean;
}

/**
 * Standard inline form error. Surfaces the real reason (not a status code)
 * and, when the session expired, an actionable "Sign in again" link so the
 * user can recover without hunting for the logout button.
 */
export function FormError({ message, sessionExpired }: FormErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-problem/20 bg-problem/5 px-4 py-3 text-sm text-problem"
    >
      <span>{message}</span>
      {sessionExpired && (
        <>
          {' '}
          <Link href="/login" className="font-medium underline">
            Sign in again
          </Link>
        </>
      )}
    </div>
  );
}
