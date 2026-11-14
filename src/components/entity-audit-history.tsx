'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchEntityAudit,
  type AuditEntityType,
  type EntityAuditRow,
} from '@/lib/audit-client';
import { cn } from '@/lib/utils';

const actionLabel: Record<string, string> = {
  add: 'Added',
  edit: 'Updated',
  delete: 'Deleted',
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function EntityAuditHistory({
  entityType,
  entityId,
  className,
  listClassName,
}: {
  entityType: AuditEntityType;
  entityId: number;
  className?: string;
  listClassName?: string;
}) {
  const [rows, setRows] = useState<EntityAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEntityAudit(entityType, entityId).then(({ data, error: err }) => {
      if (cancelled) return;
      setRows(data);
      setError(err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  return (
    <div className={cn('border-t pt-4 space-y-2', className)}>
      <p className="text-[10px] uppercase text-gray-500 tracking-wide">Audit history</p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
        </div>
      ) : error ? (
        <p className="text-sm text-amber-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No history yet for this entry. New changes will appear here.
        </p>
      ) : (
        <ul className={cn('space-y-2 max-h-48 overflow-y-auto', listClassName)}>
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900">
                  {actionLabel[row.action] || row.action}
                  <span className="font-normal text-gray-600"> by {row.user_name}</span>
                </p>
                <p className="shrink-0 text-[11px] text-gray-500">{formatWhen(row.created_at)}</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 break-words">{row.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
