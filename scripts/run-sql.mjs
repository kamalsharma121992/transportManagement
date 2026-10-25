import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
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

loadEnvFile('.env.local');
loadEnvFile('.env');

const sqlFile = resolve(process.argv[2] || 'supabase/dashboard_stats.sql');
if (!existsSync(sqlFile)) {
  console.error(`SQL file not found: ${sqlFile}`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.log(`No DATABASE_URL in .env — not connecting to the database.

Apply this file yourself:

  1. Open Supabase → SQL Editor → New query
  2. Paste ${sqlFile}
  3. Click Run

This migration is safe to re-run.

To run it from the terminal next time, add DATABASE_URL
(Supabase → Project Settings → Database → URI, sslmode=require) to .env, then:

  npm run migrate -- ${process.argv[2] || 'supabase/dashboard_stats.sql'}
`);
  process.exit(0);
}

const psql = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', sqlFile, dbUrl], {
  stdio: 'inherit',
});

if (psql.error) {
  console.error('psql is not installed or not on PATH.');
  console.error(`Paste ${sqlFile} into Supabase → SQL Editor instead.`);
  process.exit(1);
}

process.exit(psql.status ?? 1);
