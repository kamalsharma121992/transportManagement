import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';
import { adminGate, callAuthRpc } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entityType = request.nextUrl.searchParams.get('entityType');
  const entityIdRaw = request.nextUrl.searchParams.get('entityId');

  // Per-row history: any signed-in user can view audit for a specific trip/expense
  if (entityType && entityIdRaw) {
    const entityId = Number(entityIdRaw);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 });
    }
    if (entityType !== 'trip' && entityType !== 'expense') {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }
    try {
      const rows = await callAuthRpc('list_entity_audit_log', {
        p_gate: adminGate(),
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_limit: 50,
      });
      return NextResponse.json(rows ?? []);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to load audit history' },
        { status: 500 },
      );
    }
  }

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
  const body = await request.json().catch(() => null) as {
    action?: string;
    screen?: string;
    summary?: string;
    entityType?: string;
    entityId?: number;
  } | null;
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
      p_entity_type: body.entityType || null,
      p_entity_id: typeof body.entityId === 'number' ? body.entityId : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to write audit log' }, { status: 500 });
  }
}
