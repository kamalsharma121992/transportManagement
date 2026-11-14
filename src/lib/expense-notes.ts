import { getSupabase } from '@/lib/supabase';

export type ExpenseNote = {
  id: number;
  expense_id: number;
  note: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

export async function fetchExpenseNotes(expenseId: number): Promise<{ data: ExpenseNote[]; error: string | null }> {
  const { data, error } = await getSupabase()
    .from('expense_notes')
    .select('id, expense_id, note, created_by, created_at, updated_by, updated_at')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    if (error.message.includes('expense_notes') || error.message.includes('schema cache')) {
      return { data: [], error: 'Run supabase/expense_notes.sql (or ./migrate.sh) to enable descriptions.' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data || []) as ExpenseNote[], error: null };
}

/** Batch-load descriptions for a page of expenses (latest-first per expense). */
export async function fetchExpenseNotesByExpenseIds(
  expenseIds: number[],
): Promise<{ data: Record<number, ExpenseNote[]>; error: string | null }> {
  const unique = [...new Set(expenseIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return { data: {}, error: null };

  const { data, error } = await getSupabase()
    .from('expense_notes')
    .select('id, expense_id, note, created_by, created_at, updated_by, updated_at')
    .in('expense_id', unique)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    if (error.message.includes('expense_notes') || error.message.includes('schema cache')) {
      return { data: {}, error: null };
    }
    return { data: {}, error: error.message };
  }

  const map: Record<number, ExpenseNote[]> = {};
  for (const id of unique) map[id] = [];
  for (const row of (data || []) as ExpenseNote[]) {
    (map[row.expense_id] ||= []).push(row);
  }
  return { data: map, error: null };
}

export async function addExpenseNote(
  expenseId: number,
  note: string,
  createdBy: string,
): Promise<{ data: ExpenseNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Description cannot be empty' };

  const { data, error } = await getSupabase()
    .from('expense_notes')
    .insert({
      expense_id: expenseId,
      note: text,
      created_by: createdBy || 'Unknown',
    })
    .select('id, expense_id, note, created_by, created_at, updated_by, updated_at')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as ExpenseNote, error: null };
}

export async function updateExpenseNote(
  noteId: number,
  note: string,
  updatedBy: string,
): Promise<{ data: ExpenseNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Description cannot be empty' };

  const { data, error } = await getSupabase()
    .from('expense_notes')
    .update({
      note: text,
      updated_by: updatedBy || 'Unknown',
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select('id, expense_id, note, created_by, created_at, updated_by, updated_at')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as ExpenseNote, error: null };
}

export async function deleteExpenseNote(noteId: number): Promise<{ error: string | null }> {
  const { error } = await getSupabase().from('expense_notes').delete().eq('id', noteId);
  return { error: error?.message || null };
}
