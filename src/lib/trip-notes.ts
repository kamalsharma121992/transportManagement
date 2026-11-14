import { getSupabase } from '@/lib/supabase';

export type TripNote = {
  id: number;
  trip_id: number;
  note: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

export async function fetchTripNotes(tripId: number): Promise<{ data: TripNote[]; error: string | null }> {
  const { data, error } = await getSupabase()
    .from('trip_notes')
    .select('id, trip_id, note, created_by, created_at, updated_by, updated_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    if (error.message.includes('trip_notes') || error.message.includes('schema cache')) {
      return { data: [], error: 'Run supabase/trip_notes.sql (or ./migrate.sh) to enable multiple notes.' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data || []) as TripNote[], error: null };
}

/** Batch-load notes for a page of trips (latest-first per trip). */
export async function fetchTripNotesByTripIds(
  tripIds: number[],
): Promise<{ data: Record<number, TripNote[]>; error: string | null }> {
  const unique = [...new Set(tripIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return { data: {}, error: null };

  const { data, error } = await getSupabase()
    .from('trip_notes')
    .select('id, trip_id, note, created_by, created_at, updated_by, updated_at')
    .in('trip_id', unique)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    if (error.message.includes('trip_notes') || error.message.includes('schema cache')) {
      return { data: {}, error: null };
    }
    return { data: {}, error: error.message };
  }

  const map: Record<number, TripNote[]> = {};
  for (const id of unique) map[id] = [];
  for (const row of (data || []) as TripNote[]) {
    (map[row.trip_id] ||= []).push(row);
  }
  return { data: map, error: null };
}

export async function addTripNote(
  tripId: number,
  note: string,
  createdBy: string,
): Promise<{ data: TripNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Note cannot be empty' };

  const { data, error } = await getSupabase()
    .from('trip_notes')
    .insert({
      trip_id: tripId,
      note: text,
      created_by: createdBy || 'Unknown',
    })
    .select('id, trip_id, note, created_by, created_at, updated_by, updated_at')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as TripNote, error: null };
}

export async function updateTripNote(
  noteId: number,
  note: string,
  updatedBy: string,
): Promise<{ data: TripNote | null; error: string | null }> {
  const text = note.trim();
  if (!text) return { data: null, error: 'Note cannot be empty' };

  const { data, error } = await getSupabase()
    .from('trip_notes')
    .update({
      note: text,
      updated_by: updatedBy || 'Unknown',
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select('id, trip_id, note, created_by, created_at, updated_by, updated_at')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as TripNote, error: null };
}

export async function deleteTripNote(noteId: number): Promise<{ error: string | null }> {
  const { error } = await getSupabase().from('trip_notes').delete().eq('id', noteId);
  return { error: error?.message || null };
}
