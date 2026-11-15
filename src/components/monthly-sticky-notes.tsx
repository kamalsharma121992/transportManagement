'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { GripVertical, Info, Loader2, Plus, StickyNote, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSession } from '@/components/session-provider';
import { confirmAction } from '@/components/confirm-dialog';
import { EntityAuditHistory } from '@/components/entity-audit-history';
import { recordAudit } from '@/lib/audit-client';
import {
  addMonthlyNote,
  deleteMonthlyNote,
  fetchMonthlyNotes,
  reorderMonthlyNotes,
  sortMonthlyNotes,
  updateMonthlyNote,
  type MonthlyNote,
} from '@/lib/monthly-notes';
import { noteHtmlIsEmpty } from '@/lib/note-html';
import { NoteHtmlView, NoteRichEditor } from '@/components/note-rich-editor';
import { cn } from '@/lib/utils';

function stripNoteText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function monthlyNoteAuditSummary(
  action: 'Added' | 'Updated' | 'Deleted',
  month: string,
  title: string,
  noteHtml: string,
) {
  const period = monthLabel(month);
  const heading = title.trim() || stripNoteText(noteHtml).slice(0, 48) || 'Untitled note';
  const preview = stripNoteText(noteHtml);
  const body = preview && preview !== heading
    ? ` — ${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}`
    : '';
  return `${action} monthly note (${period}): ${heading}${body}`;
}

const STICKY_COLORS = [
  'bg-amber-100 border-amber-200 shadow-amber-200/60',
  'bg-lime-100 border-lime-200 shadow-lime-200/60',
  'bg-sky-100 border-sky-200 shadow-sky-200/60',
  'bg-rose-100 border-rose-200 shadow-rose-200/60',
  'bg-violet-100 border-violet-200 shadow-violet-200/60',
];

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

function monthLabel(month: string) {
  try {
    return new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function applySortOrders(rows: MonthlyNote[]): MonthlyNote[] {
  return rows.map((n, index) => ({ ...n, sort_order: index }));
}

function canSaveNote(title: string, bodyHtml: string) {
  return title.trim().length > 0 || !noteHtmlIsEmpty(bodyHtml);
}

export function MonthlyStickyNotes({
  month,
  className,
}: {
  month: string;
  className?: string;
}) {
  const session = useSession();
  const actor = session?.name || session?.username || 'Unknown';

  const [notes, setNotes] = useState<MonthlyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Cancelled this session only — cleared on refresh / remount so notes show again. */
  const [cancelledIds, setCancelledIds] = useState<Set<number>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [historyNote, setHistoryNote] = useState<MonthlyNote | null>(null);
  const dragFromIndex = useRef<number | null>(null);
  const dragAllowedRef = useRef(false);
  const didDragRef = useRef(false);

  async function load() {
    setLoading(true);
    const { data, error: err } = await fetchMonthlyNotes(month, { includeHidden: true });
    setNotes(sortMonthlyNotes(data));
    setError(err);
    setLoading(false);
  }

  useEffect(() => {
    setAdding(false);
    setDraftTitle('');
    setDraft('');
    setEditingId(null);
    setEditTitle('');
    setEditDraft('');
    setDraggingId(null);
    setDropTargetId(null);
    setCancelledIds(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when month changes
  }, [month]);

  const visibleNotes = notes.filter((n) => !cancelledIds.has(n.id));

  async function persistOrder(nextNotes: MonthlyNote[]) {
    const ordered = applySortOrders(nextNotes);
    setNotes(ordered);
    const { error: err } = await reorderMonthlyNotes(ordered.map((n) => n.id));
    if (err) {
      toast.error(err);
      void load();
    }
  }

  async function handleAdd() {
    if (!canSaveNote(draftTitle, draft) || saving) return;
    setSaving(true);
    const { data, error: err } = await addMonthlyNote(month, draft, actor, draftTitle);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    if (data) {
      setNotes((prev) => sortMonthlyNotes([data, ...prev]));
      setDraftTitle('');
      setDraft('');
      setAdding(false);
      recordAudit(
        'add',
        'Monthly Notes',
        monthlyNoteAuditSummary('Added', month, data.title, data.note),
        { type: 'monthly_note', id: data.id },
      );
      toast.success('Sticky note added');
    }
  }

  async function handleSaveEdit(noteId: number) {
    if (!canSaveNote(editTitle, editDraft) || saving) return;
    setSaving(true);
    const { data, error: err } = await updateMonthlyNote(noteId, editDraft, actor, editTitle);
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    if (data) {
      setNotes((prev) => sortMonthlyNotes(prev.map((n) => (n.id === noteId ? data : n))));
      setEditingId(null);
      setEditTitle('');
      setEditDraft('');
      recordAudit(
        'edit',
        'Monthly Notes',
        monthlyNoteAuditSummary('Updated', month, data.title, data.note),
        { type: 'monthly_note', id: data.id },
      );
      toast.success('Note updated');
    }
  }

  function handleCancel(note: MonthlyNote) {
    setCancelledIds((prev) => {
      const next = new Set(prev);
      next.add(note.id);
      return next;
    });
  }

  async function handleDelete(note: MonthlyNote) {
    if (!(await confirmAction({
      title: 'Delete sticky note?',
      description: 'This permanently removes the note.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    }))) return;

    const { error: err } = await deleteMonthlyNote(note.id);
    if (err) {
      toast.error(err);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    recordAudit(
      'delete',
      'Monthly Notes',
      monthlyNoteAuditSummary('Deleted', month, note.title, note.note),
      { type: 'monthly_note', id: note.id },
    );
    toast.success('Note deleted');
  }

  function startEdit(note: MonthlyNote) {
    setEditingId(note.id);
    setEditTitle(note.title || '');
    setEditDraft(note.note);
    setAdding(false);
  }

  function handleDragStart(noteId: number, index: number, e: DragEvent) {
    if (editingId != null || !dragAllowedRef.current) {
      e.preventDefault();
      dragAllowedRef.current = false;
      return;
    }
    didDragRef.current = false;
    dragFromIndex.current = index;
    setDraggingId(noteId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(noteId));
  }

  function handleDrag() {
    didDragRef.current = true;
  }

  function handleDragOver(noteId: number, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetId !== noteId) setDropTargetId(noteId);
  }

  function handleDrop(toIndex: number, e: DragEvent) {
    e.preventDefault();
    const fromIndex = dragFromIndex.current;
    setDraggingId(null);
    setDropTargetId(null);
    dragFromIndex.current = null;
    if (fromIndex == null || fromIndex === toIndex) return;

    const reorderedVisible = arrayMove(visibleNotes, fromIndex, toIndex);
    let vi = 0;
    const nextFull = notes.map((n) =>
      (!cancelledIds.has(n.id) ? reorderedVisible[vi++]! : n),
    );
    void persistOrder(nextFull);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
    dragFromIndex.current = null;
    dragAllowedRef.current = false;
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return (
      <div className={cn('rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500', className)}>
        Select a month to add sticky notes.
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <StickyNote className="h-4 w-4 text-amber-600" />
          Monthly notes
          <span className="font-normal text-gray-500">· {monthLabel(month)}</span>
          {visibleNotes.length > 1 && (
            <span className="font-normal text-gray-400">· drag to reorder</span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add note
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
      )}

      {adding && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 shadow-sm">
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Header (e.g. Pending tasks)"
            className="border-amber-200 bg-white/80 font-semibold"
            autoFocus
          />
          <NoteRichEditor
            value={draft}
            onChange={setDraft}
            placeholder="Bullets, bold, highlight tasks…"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !canSaveNote(draftTitle, draft)}
              onClick={() => void handleAdd()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraftTitle('');
                setDraft('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : visibleNotes.length === 0 ? (
        <p className="text-sm text-gray-400">No sticky notes yet — add one for this month.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleNotes.map((note, index) => {
            const color = STICKY_COLORS[index % STICKY_COLORS.length];
            const editing = editingId === note.id;
            const isDragging = draggingId === note.id;
            const isDropTarget = dropTargetId === note.id && draggingId !== note.id;
            return (
              <div
                key={note.id}
                draggable={!editing}
                onDragStart={(e) => handleDragStart(note.id, index, e)}
                onDrag={handleDrag}
                onDragOver={(e) => handleDragOver(note.id, e)}
                onDrop={(e) => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'relative flex min-h-[140px] flex-col rounded-sm border p-3 shadow-md transition-opacity',
                  color,
                  isDragging && 'opacity-40',
                  isDropTarget && 'ring-2 ring-amber-500 ring-offset-1',
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-1">
                    <span
                      className="mt-0.5 shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-hidden
                      onMouseDown={() => {
                        dragAllowedRef.current = true;
                      }}
                      onTouchStart={() => {
                        dragAllowedRef.current = true;
                      }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <p className="text-[10px] text-gray-600">
                      {note.created_by}
                      {' · '}
                      {formatWhen(note.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded p-1 text-gray-600 hover:bg-black/5"
                      title="Audit history"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistoryNote(note);
                      }}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-gray-600 hover:bg-black/5"
                      title="Dismiss for now (shows again after refresh)"
                      onClick={() => handleCancel(note)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-gray-600 hover:bg-black/5 hover:text-red-600"
                      title="Delete permanently"
                      onClick={() => void handleDelete(note)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Header"
                      className="h-8 border-black/10 bg-white/70 font-semibold"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <NoteRichEditor
                      value={editDraft}
                      onChange={setEditDraft}
                      placeholder="Bullets, bold, highlight tasks…"
                      autofocus
                      minHeightClass="min-h-[90px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        disabled={saving || !canSaveNote(editTitle, editDraft)}
                        onClick={() => void handleSaveEdit(note.id)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => {
                          setEditingId(null);
                          setEditTitle('');
                          setEditDraft('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex flex-1 cursor-text flex-col rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                    title="Click to edit"
                    onClick={() => {
                      if (didDragRef.current) {
                        didDragRef.current = false;
                        return;
                      }
                      startEdit(note);
                    }}
                  >
                    {note.title?.trim() ? (
                      <p className="mb-1 text-sm font-semibold text-gray-900">{note.title}</p>
                    ) : null}
                    <NoteHtmlView html={note.note} className="w-full" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={historyNote != null} onOpenChange={(open) => { if (!open) setHistoryNote(null); }}>
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          {historyNote && (
            <>
              <DialogHeader className="border-b px-4 py-3 pr-12 sm:px-5">
                <DialogTitle className="truncate">
                  {historyNote.title?.trim() || 'Note history'}
                </DialogTitle>
                <p className="text-sm text-gray-500">
                  {monthLabel(historyNote.month)} · audit log for this note
                </p>
              </DialogHeader>
              <div className="max-h-[min(70vh,28rem)] overflow-y-auto px-4 py-3 sm:px-5">
                <EntityAuditHistory
                  entityType="monthly_note"
                  entityId={historyNote.id}
                  className="border-t-0 pt-0"
                  listClassName="max-h-none"
                />
              </div>
              <div className="border-t px-4 py-3 sm:px-5">
                <Button type="button" variant="outline" className="w-full" onClick={() => setHistoryNote(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
