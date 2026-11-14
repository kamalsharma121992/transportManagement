'use client';

import { useEffect, useState } from 'react';
import {
  fetchEntityAudit,
  type AuditEntityType,
} from '@/lib/audit-client';
import { cn } from '@/lib/utils';

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

/**
 * Shows who created a trip/expense from the earliest "add" audit entry.
 */
export function EntityCreatedBy({
  entityType,
  entityId,
  className,
}: {
  entityType: AuditEntityType;
  entityId: number;
  className?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEntityAudit(entityType, entityId).then(({ data }) => {
      if (cancelled) return;
      // API returns newest first — take the oldest "add"
      const adds = data.filter((r) => r.action === 'add');
      const created = adds.length > 0 ? adds[adds.length - 1] : null;
      if (!created?.user_name) {
        setLabel(null);
        return;
      }
      setLabel(`Added by ${created.user_name} · ${formatWhen(created.created_at)}`);
    });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (!label) return null;

  return (
    <p className={cn('text-xs text-gray-500', className)}>
      {label}
    </p>
  );
}
