import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabase } from '@/lib/supabase';

export const BACKUP_TABLES = [
  'partners',
  'drivers',
  'vehicles',
  'routes',
  'trips',
  'credit_cards',
  'expenses',
  'capital_contributions',
  'banking_information',
  'expense_categories',
  'driver_leave',
  'driver_payroll_period',
  'expense_advances',
  'app_config',
  'app_roles',
  'app_role_pages',
  'app_users',
  'audit_log',
] as const;

const PAGE_SIZE = 1000;
const KEEP_DAYS = 30;

export type BackupFile = {
  generatedAt: string;
  timezone: 'Asia/Kolkata';
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

export function istDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function backupFileName(d = new Date()): string {
  return `jm-transport-${istDateString(d)}.json`;
}

async function fetchAllRows(table: string): Promise<unknown[]> {
  const supabase = getSupabase();
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      const missing = /schema cache|does not exist|could not find the table/i.test(error.message);
      if (missing) return [];
      throw new Error(`${table}: ${error.message}`);
    }
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await fetchAllRows(table);
    tables[table] = rows;
    counts[table] = rows.length;
  }
  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    tables,
    counts,
  };
}

export async function writeBackupFile(backup: BackupFile, directory?: string): Promise<string> {
  const dir = directory || join(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, backupFileName());
  await writeFile(filePath, JSON.stringify(backup), 'utf8');
  await pruneOldBackups(dir);
  return filePath;
}

async function pruneOldBackups(dir: string) {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(names.map(async (name) => {
    if (!name.startsWith('jm-transport-') || !name.endsWith('.json')) return;
    const stamp = name.slice('jm-transport-'.length, -'.json'.length);
    const time = Date.parse(`${stamp}T00:00:00+05:30`);
    if (!Number.isFinite(time) || time >= cutoff) return;
    await unlink(join(dir, name)).catch(() => undefined);
  }));
}

export { authorizationMatchesBackupSecret, backupSecret } from '@/lib/backup-auth';
