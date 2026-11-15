import { getSupabase } from '@/lib/supabase';

export type MonthlyNote = {
  id: number;
  month: string;
  note: string;
  is_hidden: boolean;
  sort_order: number;
  pos_x: number;
  pos_y: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

const SELECT =
  'id, month, note, is_hidden, sort_order, pos_x, pos_y, created_by, created_at, updated_by, updated_at';

function missingTableError(message: string) {
  return message.includes('monthly_notes') || message.includes('schema cache');
}

export function sortMonthlyNotes(rows: MonthlyNote[]) {
  return rows.slice().sort((a, b) => {
    const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (byOrder !== 0) return byOrder;
    const byCreated = b.created_at.localeCompare(a.created_at);
    return byCreated !== 0 ? byCreated : b.id - a.id;
  });
}

function normalizeNote(row: MonthlyNote): MonthlyNote {
  return {
    ...row,
    pos_x: Number(row.pos_x ?? 24),
    pos_y: Number(row.pos_y ?? 72),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export async function fetchMonthlyNotes(
  month: string,
  opts?: { includeHidden?: boolean },
): Promise<{ data: MonthlyNote[]; error: string | null }> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { data: [], error: 'Invalid month' };
  }

  let query = getSupabase()
    .from('monthly_notes')
    .select(SELECT)
    .eq('month', month)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (!opts?.includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data, error } = await query;
  if (error) {
    if (missingTableError(error.message) || error.message.includes('pos_x') || error.message.includes('sort_order')) {
      return {
        data: [],
        error: 'Run ./migrate.sh to enable monthly sticky notes.',
      };
    }
    return { data: [], error: error.message };
  }
  return {
    data: sortMonthlyNotes(((data || []) as MonthlyNote[]).map(normalizeNote)),
    error: null,
  };
}

export async function addMonthlyNote(
  month: string,
  note: string,
  createdBy: string,
): Promise<{ data: MonthlyNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Note cannot be empty' };
  if (!/^\d{4}-\d{2}$/.test(month)) return { data: null, error: 'Invalid month' };

  const { data: existing } = await getSupabase()
    .from('monthly_notes')
    .select('sort_order')
    .eq('month', month)
    .order('sort_order', { ascending: true })
    .limit(1);

  const nextOrder = existing && existing.length > 0
    ? Number(existing[0].sort_order) - 1
    : 0;

  const { data, error } = await getSupabase()
    .from('monthly_notes')
    .insert({
      month,
      note: text,
      created_by: createdBy || 'Unknown',
      is_hidden: false,
      sort_order: nextOrder,
    })
    .select(SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeNote(data as MonthlyNote), error: null };
}

export async function updateMonthlyNote(
  noteId: number,
  note: string,
  updatedBy: string,
): Promise<{ data: MonthlyNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Note cannot be empty' };

  const { data, error } = await getSupabase()
    .from('monthly_notes')
    .update({
      note: text,
      updated_by: updatedBy || 'Unknown',
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select(SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeNote(data as MonthlyNote), error: null };
}

export async function setMonthlyNoteHidden(
  noteId: number,
  isHidden: boolean,
): Promise<{ data: MonthlyNote | null; error: string | null }> {
  const { data, error } = await getSupabase()
    .from('monthly_notes')
    .update({ is_hidden: isHidden })
    .eq('id', noteId)
    .select(SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: normalizeNote(data as MonthlyNote), error: null };
}

export async function reorderMonthlyNotes(
  orderedIds: number[],
): Promise<{ error: string | null }> {
  if (orderedIds.length === 0) return { error: null };

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      getSupabase()
        .from('monthly_notes')
        .update({ sort_order: index })
        .eq('id', id),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  return { error: null };
}

export async function deleteMonthlyNote(noteId: number): Promise<{ error: string | null }> {
  const { error } = await getSupabase().from('monthly_notes').delete().eq('id', noteId);
  return { error: error?.message || null };
}
