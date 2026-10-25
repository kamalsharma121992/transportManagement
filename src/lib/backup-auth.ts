export function backupSecret(): string {
  return process.env.BACKUP_SECRET || process.env.CRON_SECRET || '';
}

export function authorizationMatchesBackupSecret(header: string | null): boolean {
  const secret = backupSecret();
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
