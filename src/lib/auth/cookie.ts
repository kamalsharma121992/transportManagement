import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_HOURS, verifySession, type SessionPayload } from '@/lib/auth/token';

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60,
  };
}
