import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.sub,
    name: session.name,
    username: session.username,
    role: session.role,
    pages: session.pages,
    driverId: session.driverId,
    driverName: session.driverName,
  });
}
