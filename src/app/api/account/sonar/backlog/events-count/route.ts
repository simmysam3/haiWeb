import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/backlog/events-count
 *
 * Sidebar-badge count for the Backlog section (Events mode). v.1.41 Backlog
 * IA restructure, PR-2 (spec
 * `docs/superpowers/specs/2026-05-23-v1_41-backlog-ia-restructure-design.md`).
 *
 * Interim implementation: derives the count from the existing
 * `/sonar/compliance/changes` feed (default 14-day window). PR-3 will swap
 * this for a dedicated haiCore count endpoint once the badge semantics
 * (`unread since last visit` vs `total in window`) are agreed.
 *
 * `oldest_age_days` is computed from the oldest `detected_at` in the feed
 * so the sidebar badge can pick up the existing NavBadge tone scale
 * (slate / amber / red).
 */
export const GET = withHaiCore(async ({ client }) => {
  const feed = (await client.listComplianceChanges({})) as ComplianceChangeFeedResponse;
  const oldestAt = feed.changes.reduce<string | null>((acc, change) => {
    if (acc === null || change.detected_at < acc) return change.detected_at;
    return acc;
  }, null);
  const oldestAgeDays =
    oldestAt === null
      ? null
      : Math.floor((Date.now() - new Date(oldestAt).getTime()) / 86_400_000);
  return NextResponse.json({
    events_count: feed.total,
    oldest_age_days: oldestAgeDays,
  });
});
