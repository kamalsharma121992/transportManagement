export type AuditAction = 'add' | 'edit' | 'delete';

export type AuditEntityType = 'trip' | 'expense';

export type EntityAuditRow = {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  screen: string;
  summary: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
};

export function recordAudit(
  action: AuditAction,
  screen: string,
  summary: string,
  entity?: { type: AuditEntityType; id: number | null | undefined },
) {
  void fetch('/api/audit', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      screen,
      summary,
      entityType: entity?.type,
      entityId: entity?.id ?? undefined,
    }),
  }).catch(() => undefined);
}

export async function fetchEntityAudit(
  entityType: AuditEntityType,
  entityId: number,
): Promise<{ data: EntityAuditRow[]; error: string | null }> {
  try {
    const res = await fetch(
      `/api/audit?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`,
      { credentials: 'include' },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: [], error: (body && body.error) || 'Failed to load audit history' };
    }
    return { data: Array.isArray(body) ? body : [], error: null };
  } catch {
    return { data: [], error: 'Failed to load audit history' };
  }
}
