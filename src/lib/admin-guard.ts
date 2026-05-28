import { getSession } from './auth';

/** Throws 403 Response if the caller is not an admin. Use in BFF routes. */
export async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (!session?.is_admin) {
    throw new Response('Forbidden', { status: 403 });
  }
}

/** Returns true if the caller has admin privileges. Use in Server Components. */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.is_admin === true;
}
