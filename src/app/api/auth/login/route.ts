import { NextResponse } from 'next/server';
import { callAuthRpc } from '@/lib/auth/server';
import { sessionCookieOptions } from '@/lib/auth/cookie';
import { SESSION_COOKIE, signSession } from '@/lib/auth/token';

type AuthUser = {
  id: number;
  name: string;
  username: string;
  role: string;
  driverId: number | null;
  driverName: string | null;
  pages: string[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = body?.username?.trim() ?? '';
  const password = body?.password ?? '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  try {
    const user = await callAuthRpc<AuthUser | null>('authenticate_user', {
      p_username: username,
      p_password: password,
    });
    if (!user?.id) {
      return NextResponse.json({ error: 'Wrong username or password' }, { status: 401 });
    }
    const token = await signSession({
      sub: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      pages: user.pages ?? [],
      driverId: user.driverId ?? null,
      driverName: user.driverName ?? null,
    });
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      pages: user.pages ?? [],
      driverId: user.driverId ?? null,
      driverName: user.driverName ?? null,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    if (/could not find the function|schema cache/i.test(message)) {
      return NextResponse.json({ error: 'Run supabase/app_users.sql in the Supabase SQL editor, then try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
