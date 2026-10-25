import { createClient } from '@supabase/supabase-js';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLES = [
  'partners', 'drivers', 'vehicles', 'routes', 'trips', 'credit_cards',
  'expenses', 'capital_contributions', 'banking_information', 'expense_categories',
  'driver_leave', 'driver_payroll_period', 'expense_advances',
  'app_config', 'app_roles', 'app_role_pages', 'app_users', 'audit_log',
];
const PAGE_SIZE = 1000;
const KEEP_DAYS = 30;

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSyncSafe(file).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readFileSyncSafe(file) {
  return readFileSync(file, 'utf8');
}

loadEnvFile('.env.local');
loadEnvFile('.env');

function istDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function fetchAllRows(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (/schema cache|does not exist|could not find the table/i.test(error.message)) return [];
      throw new Error(`${table}: ${error.message}`);
    }
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function pruneOldBackups(dir) {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const names = await readdir(dir).catch(() => []);
  await Promise.all(names.map(async (name) => {
    if (!name.startsWith('jm-transport-') || !name.endsWith('.json')) return;
    const stamp = name.slice('jm-transport-'.length, -'.json'.length);
    const time = Date.parse(`${stamp}T00:00:00+05:30`);
    if (!Number.isFinite(time) || time >= cutoff) return;
    await unlink(join(dir, name)).catch(() => undefined);
  }));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const tables = {};
  const counts = {};
  for (const table of TABLES) {
    const rows = await fetchAllRows(supabase, table);
    tables[table] = rows;
    counts[table] = rows.length;
    console.log(`  ${table}: ${rows.length}`);
  }

  const backup = {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    tables,
    counts,
  };

  const dir = join(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  const fileName = `jm-transport-${istDateString()}.json`;
  const filePath = join(dir, fileName);
  await writeFile(filePath, JSON.stringify(backup), 'utf8');
  await pruneOldBackups(dir);
  console.log(`Saved ${filePath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
