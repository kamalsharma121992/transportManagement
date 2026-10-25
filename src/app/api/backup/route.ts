import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/cookie';
import {
  authorizationMatchesBackupSecret,
  backupFileName,
  buildBackup,
  writeBackupFile,
} from '@/lib/backup';

export const maxDuration = 60;

async function canBackup(request: Request): Promise<boolean> {
  if (authorizationMatchesBackupSecret(request.headers.get('authorization'))) return true;
  const session = await readSession();
  return session?.role === 'Admin';
}

export async function GET(request: Request) {
  if (!(await canBackup(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const backup = await buildBackup();
    const download = new URL(request.url).searchParams.get('download') === '1';
    let savedTo: string | null = null;
    try {
      savedTo = await writeBackupFile(backup);
    } catch {
      try {
        savedTo = await writeBackupFile(backup, '/tmp');
      } catch {
        savedTo = null;
      }
    }

    if (download) {
      return new NextResponse(JSON.stringify(backup), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${backupFileName()}"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      generatedAt: backup.generatedAt,
      file: backupFileName(),
      savedTo,
      counts: backup.counts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backup failed' },
      { status: 500 },
    );
  }
}
