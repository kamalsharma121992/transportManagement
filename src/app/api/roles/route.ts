import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';
import { adminGate, callAuthRpc } from '@/lib/auth/server';

async function requireAdmin() {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.role !== 'Admin') return { error: NextResponse.json({ error: 'Only Admin can manage roles' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;
  try {
    const roles = await callAuthRpc('list_app_roles', { p_gate: adminGate() });
    return NextResponse.json(roles ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load roles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;
  const body = await request.json().catch(() => null) as {
    id?: number | null;
    name?: string;
    pages?: string[];
  } | null;
  try {
    const saved = await callAuthRpc('save_app_role', {
      p_gate: adminGate(),
      p_id: body?.id ?? null,
      p_name: body?.name ?? '',
      p_pages: body?.pages ?? [],
    });
    await callAuthRpc('write_audit_log', {
      p_gate: adminGate(),
      p_user_id: auth.session.sub,
      p_user_name: auth.session.name,
      p_action: body?.id ? 'edit' : 'add',
      p_screen: 'Roles',
      p_summary: `${body?.id ? 'Updated' : 'Created'} role ${body?.name ?? ''}`,
    });
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save role' }, { status: 400 });
  }
}
