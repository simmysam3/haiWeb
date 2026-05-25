import ChangesPage from './changes/page';

/**
 * v.1.41 Backlog IA default landing — the section root /sonar/posture
 * now renders the Events surface (formerly Changes). This replaces the
 * v1.37 contract where the root delegated to Working List.
 *
 * The default landing matches what the sidebar badge counts (events
 * count, see BacklogNavItem in account-nav.tsx). Gaps and Obligations
 * are reached via their tabs.
 *
 * Canonical Events URL stays /sonar/posture/changes; this duplicate
 * landing on the section root is the "implicit default" — the
 * BacklogTabs component's active-tab logic lights Events for both
 * paths.
 *
 * Mirrors the pattern in /sonar/requests/page.tsx where the section
 * root delegates to its default queue.
 */
interface SearchParams {
  kind?: string | string[];
  partner?: string;
  from?: string;
  to?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function BacklogLandingPage(props: PageProps) {
  return ChangesPage(props);
}
