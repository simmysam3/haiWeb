// src/lib/help/help-upstream.ts
import { NextResponse } from 'next/server';
import {
  PROTOCOL_VERSION,
  HELP_SERVED_GUIDE_SHA_HEADER,
  HELP_SERVED_AGENT_VERSION_HEADER,
} from '@haiwave/protocol';
import { getSession, getToken } from '@/lib/auth';
import { isJwtLike } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';
import { readServedGuide } from './served-guide';

export interface HelpAuth {
  token: string;
  participantId: string;
}

/** Shared gate for /api/help/*: 404 while the flag is off (spec §9.3), then session + JWT. */
export async function helpAuth(): Promise<HelpAuth | NextResponse> {
  if (!loadEnv().HELP_AGENT_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = await getToken();
  if (!isJwtLike(token)) return NextResponse.json({ error: 'No token' }, { status: 401 });
  return { token, participantId: session.participant.id };
}

interface HelpUpstreamInit {
  method: 'GET' | 'POST';
  body?: string;
  signal?: AbortSignal;
  /** Attach the served-guide headers (spec §6.3 step 1a). */
  served?: boolean;
}

/** Raw fetch to haiCore's /api/v1 help routes — the createHaiwaveClient headers, plus the served-guide pair. */
export async function helpUpstream(auth: HelpAuth, path: string, init: HelpUpstreamInit): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    'x-haiwave-participant-id': auth.participantId,
    'X-HaiWave-Protocol-Version': PROTOCOL_VERSION,
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.served) {
    const served = await readServedGuide();
    if (served.guideSha) headers[HELP_SERVED_GUIDE_SHA_HEADER] = served.guideSha;
    if (served.agentVersion) headers[HELP_SERVED_AGENT_VERSION_HEADER] = served.agentVersion;
  }
  return fetch(`${loadEnv().HAIWAVE_API_URL}/api/v1${path}`, {
    method: init.method,
    headers,
    body: init.body,
    signal: init.signal,
  });
}

/** Relay haiCore's status and body verbatim (the panel reads haiCore's error codes). */
export async function relayJson(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
