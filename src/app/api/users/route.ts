import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';
import { adminGate, callAuthRpc } from '@/lib/auth/server';

async function requireAdmin() {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.role !== 'Admin') return { error: NextResponse.json({ error: 'Only Admin can manage users' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;
  try {
    const users = await callAuthRpc('list_app_users', { p_gate: adminGate() });
    return NextResponse.json(users ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;
  const body = await request.json().catch(() => null) as {
    id?: number | null;
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    roleId?: number;
    driverId?: number | null;
    isActive?: boolean;
  } | null;
  try {
    const saved = await callAuthRpc('save_app_user', {
      p_gate: adminGate(),
      p_id: body?.id ?? null,
      p_name: body?.name ?? '',
      p_username: body?.username ?? '',
      p_email: body?.email ?? '',
      p_password: body?.password ?? '',
      p_role_id: body?.roleId ?? null,
      p_driver_id: body?.driverId ?? null,
      p_active: body?.isActive ?? true,
    });
    await callAuthRpc('write_audit_log', {
      p_gate: adminGate(),
      p_user_id: auth.session.sub,
      p_user_name: auth.session.name,
      p_action: body?.id ? 'edit' : 'add',
      p_screen: 'Users',
      p_summary: `${body?.id ? 'Updated' : 'Created'} user ${body?.username ?? ''}`,
    });
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save user' }, { status: 400 });
  }
}
