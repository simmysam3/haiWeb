import Link from 'next/link';

// v1.47 (D-19) — /register is now the post-approval ACTIVATION LANDING.
//
// The open multi-step self-signup form (which instantly provisioned a
// Keycloak identity + Stripe customer + participant and auto-logged-in) has
// been retired. New suppliers apply at haiwave.ai/join; an approved applicant
// receives a Keycloak `execute-actions-email` link that lands here after they
// set their password and enrol MFA. This page just orients them to sign in.
export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-navy">
        Activate your HAIWAVE account
      </h1>
      <p className="text-base text-charcoal">
        Your supplier registration has been approved. Follow the activation link in the email we
        sent to set your password and enrol multi-factor authentication. Once that&apos;s done you
        can sign in to your account.
      </p>
      <p className="text-sm text-slate">
        Didn&apos;t apply yet? New suppliers request access at{' '}
        <a href="https://haiwave.ai/join" className="text-teal-700 hover:underline">
          haiwave.ai/join
        </a>
        .
      </p>
      <Link
        href="/login"
        className="rounded bg-teal px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-dark"
      >
        Sign in
      </Link>
    </main>
  );
}
