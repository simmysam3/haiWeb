import WorkingListPage from './working-list/page';

/**
 * v1.37 Posture default landing — the Working List IS the section's index
 * route (mirrors how `/sonar/requests/page.tsx` makes the Active queue the
 * default landing for Request Management). We delegate to the dedicated
 * working-list page so the canonical URL `/sonar/posture/working-list` and
 * the section-root URL `/sonar/posture` render the same content.
 *
 * Coverage moved to `/sonar/dashboard` in the second v1.37 restructure; the
 * slim coverage-context header strip in `posture/layout.tsx` keeps the
 * coverage % visible on every Posture child page.
 */
interface SearchParams {
  categories?: string;
  status?: string;
  sort?: string;
  partner_id?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function PostureLandingPage(props: PageProps) {
  return WorkingListPage(props);
}
