import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';
import { adminGate, callAuthRpc } from '@/lib/auth/server';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'Admin' && !session.pages.includes('audit')) {
    return NextResponse.json({ error: 'Only Admin can view the audit log' }, { status: 403 });
  }
  try {
    const rows = await callAuthRpc('list_audit_log', { p_gate: adminGate(), p_limit: 200 });
    return NextResponse.json(rows ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load audit log' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; screen?: string; summary?: string } | null;
  if (!body?.action || !body.screen || !body.summary) {
    return NextResponse.json({ error: 'action, screen, and summary are required' }, { status: 400 });
  }
  try {
    await callAuthRpc('write_audit_log', {
      p_gate: adminGate(),
      p_user_id: session.sub,
      p_user_name: session.name,
      p_action: body.action,
      p_screen: body.screen,
      p_summary: body.summary,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to write audit log' }, { status: 500 });
  }
}
