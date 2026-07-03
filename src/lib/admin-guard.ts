import { getSession } from './auth';

/** Returns true if the caller has admin privileges. Use in Server Components. */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.is_admin === true;
}
