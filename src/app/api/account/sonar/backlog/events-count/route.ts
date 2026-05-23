import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/backlog/events-count
 *
 * Sidebar-badge count for the Backlog section (Events mode). v.1.41
 * Backlog IA restructure (spec
 * `docs/superpowers/specs/2026-05-23-v1_41-backlog-ia-restructure-design.md`).
 *
 * PR-3: thin passthrough to the dedicated haiCore count endpoint
 * (`GET /sonar/compliance/changes/count`). Replaces the PR-2 interim
 * implementation which derived the count by fetching the full feed
 * payload. The haiCore endpoint runs `COUNT()` + `MIN(detected_at)` in
 * a single query — no row transfer.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getComplianceChangesCount());
});
