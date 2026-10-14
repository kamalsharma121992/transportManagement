export function recordAudit(action: 'add' | 'edit' | 'delete', screen: string, summary: string) {
  void fetch('/api/audit', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, screen, summary }),
  }).catch(() => undefined);
}
