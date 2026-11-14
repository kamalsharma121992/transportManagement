'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSession } from '@/components/session-provider';
import { recordAudit } from '@/lib/audit-client';
import { getSupabase } from '@/lib/supabase';
import {
  addTripNote,
  deleteTripNote,
  fetchTripNotes,
  updateTripNote,
  type TripNote,
} from '@/lib/trip-notes';
import { cn } from '@/lib/utils';

async function syncTripNotesPreview(tripId: number, latestNote: string | null) {
  await getSupabase()
    .from('trips')
    .update({ notes: latestNote })
    .eq('id', tripId);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TripNotesPanel({
  tripId,
  className,
  listClassName,
}: {
  tripId: number;
  className?: string;
  listClassName?: string;
}) {
  const session = useSession();
  const actor = session?.name || session?.username || 'Unknown';

  const [notes, setNotes] = useState<TripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  async function load() {
    setLoading(true);
    const { data, error: err } = await fetchTripNotes(tripId);
    setNotes(data);
    setError(err);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [tripId]);

  async function handleAdd() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const { data, error: err } = await addTripNote(tripId, draft, actor);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    if (data) {
      setNotes((prev) => {
        const next = [data, ...prev];
        void syncTripNotesPreview(tripId, next[0]?.note || null);
        return next;
      });
      setDraft('');
      recordAudit('add', 'Trip Log', `Added note on trip #${tripId}`, { type: 'trip', id: tripId });
      toast.success('Note added');
    }
  }

  async function handleSaveEdit(noteId: number) {
    if (!editDraft.trim() || saving) return;
    setSaving(true);
    const { data, error: err } = await updateTripNote(noteId, editDraft, actor);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    if (data) {
      setNotes((prev) => {
        const next = prev.map((n) => (n.id === noteId ? data : n));
        void syncTripNotesPreview(tripId, next[0]?.note || null);
        return next;
      });
      setEditingId(null);
      setEditDraft('');
      recordAudit('edit', 'Trip Log', `Updated note on trip #${tripId}`, { type: 'trip', id: tripId });
      toast.success('Note updated');
    }
  }

  async function handleDelete(noteId: number) {
    if (!confirm('Delete this note?')) return;
    setSaving(true);
    const { error: err } = await deleteTripNote(noteId);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      void syncTripNotesPreview(tripId, next[0]?.note || null);
      return next;
    });
    if (editingId === noteId) {
      setEditingId(null);
      setEditDraft('');
    }
    recordAudit('delete', 'Trip Log', `Deleted note on trip #${tripId}`, { type: 'trip', id: tripId });
    toast.success('Note deleted');
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-[10px] uppercase text-gray-500 tracking-wide">Notes</p>

      <div className="space-y-2">
        <Label className="sr-only">Add note</Label>
        <textarea
          className="w-full min-h-[72px] border rounded-md px-3 py-2 text-sm"
          placeholder="Add a note..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
        />
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={saving || !draft.trim()}
          onClick={() => void handleAdd()}
        >
          {saving && !editingId ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</>
          ) : (
            <><Plus className="h-3.5 w-3.5 mr-1" /> Add note</>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes...
        </div>
      ) : error ? (
        <p className="text-sm text-amber-700">{error}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className={cn('space-y-2 max-h-56 overflow-y-auto', listClassName)}>
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full min-h-[64px] border rounded-md px-2 py-1.5 text-sm bg-white"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    disabled={saving}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      disabled={saving || !editDraft.trim()}
                      onClick={() => void handleSaveEdit(n.id)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={saving}
                      onClick={() => { setEditingId(null); setEditDraft(''); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-900 whitespace-pre-wrap">{n.note}</p>
                  <div className="mt-1.5 flex items-start justify-between gap-2">
                    <div className="text-[11px] text-gray-500 space-y-0.5">
                      <p>
                        Added by <span className="font-medium text-gray-700">{n.created_by}</span>
                        {' · '}
                        {formatWhen(n.created_at)}
                      </p>
                      {n.updated_at && n.updated_by && (
                        <p>
                          Edited by <span className="font-medium text-gray-700">{n.updated_by}</span>
                          {' · '}
                          {formatWhen(n.updated_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit note"
                        disabled={saving}
                        onClick={() => { setEditingId(n.id); setEditDraft(n.note); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Delete note"
                        disabled={saving}
                        onClick={() => void handleDelete(n.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
