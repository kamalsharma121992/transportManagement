import { NextResponse, type NextRequest } from 'next/server';
import { pageKeyForPath, homeForPages, sessionCanOpen } from '@/lib/auth/pages';
import { authorizationMatchesBackupSecret } from '@/lib/backup-auth';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/token';

const OPEN_PATHS = new Set(['/login', '/api/auth/login']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/api/backup' && authorizationMatchesBackupSecret(request.headers.get('authorization'))) {
    return NextResponse.next();
  }
  if (OPEN_PATHS.has(pathname)) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (pathname === '/login' && session) {
      return NextResponse.redirect(new URL(homeForPages(session.pages), request.url));
    }
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith('/api/')) return NextResponse.next();

  const page = pageKeyForPath(pathname);
  if (page && !sessionCanOpen(session.pages, page)) {
    return NextResponse.redirect(new URL(homeForPages(session.pages), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
