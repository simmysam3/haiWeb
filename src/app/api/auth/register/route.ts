import { NextResponse } from 'next/server';

// v1.47 (D-19) — the open self-service registration endpoint is RETIRED.
//
// The instant-provision bypass (inline Keycloak user create + Stripe customer
// create + immediate auto-login) is gone. New suppliers now apply through the
// public join flow (haiPublic → haiCore POST /api/v1/public/register), which
// creates an inert holding-pen request; a HAIWAVE admin adjudicates it in the
// gatekeeper console, and on approval haiCore provisions the Keycloak identity
// (with MFA) through a least-privilege admin client. NO identity, billing, or
// participant creation happens in haiWeb anymore.
//
// This handler is kept only to return an explicit 410 (instead of a confusing
// 404) for any stale client still POSTing the old signup payload.
export function POST() {
  return NextResponse.json(
    {
      error: 'Self-service registration is closed.',
      code: 'registration_closed',
      message:
        'Apply at haiwave.ai/join. Approved applicants receive an email link to activate their account.',
    },
    { status: 410 },
  );
}
