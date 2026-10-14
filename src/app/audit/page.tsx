'use client';

import { PageHeader } from '@/components/page-header';
import { AuditSection } from '@/components/admin-access';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" />
      <AuditSection />
    </div>
  );
}
