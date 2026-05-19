interface Props {
  status: number;
}

/**
 * Rendered when getActiveScopes returns kind:'error'. Distinguishes server
 * outage from "no scopes yet" (which routes to NoScopesCTA) so the user
 * is not falsely told to nominate trading partners while haiCore is down.
 */
export function ScopesErrorBanner({ status }: Props) {
  return (
    <div
      role="alert"
      className="rounded-md border border-problem/20 bg-problem/5 p-4 text-sm text-problem"
    >
      Couldn&apos;t load your audit scopes
      {status >= 500
        ? ' — the audit service is temporarily unavailable. Please retry shortly.'
        : status === 403
        ? ' — you do not have permission to view audit scopes.'
        : status === 0
        ? ' — network failure reaching the BFF.'
        : ` — server returned ${status}.`}
    </div>
  );
}
