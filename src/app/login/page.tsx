import { redirect } from "next/navigation";

/**
 * The portal no longer shows a sign-in card. `/login` (and any lingering link to
 * it) bounces straight to the OIDC start route, which redirects to Keycloak.
 * A `?next=` is forwarded if present so deep links keep their destination.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login");
}
