'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, EXPENSE_TYPES, EXPENSE_ADVANCE_CATEGORY, type ExpenseType } from '@/lib/supabase';
import {
  buildCategoriesByType,
  DEFAULT_CATEGORIES_BY_TYPE,
  fetchExpenseCategories,
} from '@/lib/expense-categories';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  fetchSettlementLines,
  fetchExpenseAdvances,
  settleExpenseAdvance,
  updateExpenseAdvance,
  deleteExpenseAdvance,
  type LeftoverAction,
  type ExpenseAdvanceRow,
  type ExpenseAdvanceSettlementLine,
} from '@/lib/expense-advances';
import {
  EXPENSE_ADVANCE_OVERDUE_DAYS,
  EXPENSE_ADVANCE_WARNING_DAYS,
} from '@/lib/constants';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type FilterTab = 'open' | 'all' | 'settled';

const FLOAT_CATEGORIES = new Set([EXPENSE_ADVANCE_CATEGORY]);

const emptyLine = (): ExpenseAdvanceSettlementLine => ({
  expense_type: 'vehicle',
  category: '',
  amount: 0,
  vehicle_number: '',
  description: '',
});

type EditForm = {
  date: string;
  person: string;
  amount: string;
  notes: string;
};

export default function ExpenseAdvancesPage() {
  const [rows, setRows] = useState<ExpenseAdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('open');
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [categoriesByType, setCategoriesByType] = useState(DEFAULT_CATEGORIES_BY_TYPE);
  const [settling, setSettling] = useState<ExpenseAdvanceRow | null>(null);
  const [existingLines, setExistingLines] = useState<Awaited<ReturnType<typeof fetchSettlementLines>>>([]);
  const [lines, setLines] = useState<ExpenseAdvanceSettlementLine[]>([emptyLine()]);
  const [leftoverAction, setLeftoverAction] = useState<LeftoverAction>('keep_open');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ExpenseAdvanceRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ date: '', person: '', amount: '', notes: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await fetchExpenseAdvances();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load expense advances');
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data: partnerRows }) => {
      supabase.from('drivers').select('name').order('name').then(({ data: driverRows }) => {
        const names = new Set<string>();
        (partnerRows || []).forEach((p: { name: string }) => names.add(p.name));
        (driverRows || []).forEach((d: { name: string }) => names.add(d.name));
        setPartners([...names].sort((a, b) => a.localeCompare(b)));
      });
    });
    fetchExpenseCategories().then(({ data }) => {
      if (data.length) setCategoriesByType(buildCategoriesByType(data));
    }).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    if (filter === 'open') return rows.filter((r) => r.status !== 'Settled');
    if (filter === 'settled') return rows.filter((r) => r.status === 'Settled');
    return rows;
  }, [rows, filter]);

  const summary = useMemo(() => {
    const open = rows.filter((r) => r.status !== 'Settled');
    return {
      openCount: open.length,
      openAmount: open.reduce((s, r) => s + r.remaining, 0),
      warning: open.filter((r) => r.alert === 'warning').length,
      overdue: open.filter((r) => r.alert === 'overdue').length,
    };
  }, [rows]);

  async function openSettle(row: ExpenseAdvanceRow) {
    setSettling(row);
    setLines([emptyLine()]);
    setLeftoverAction('keep_open');
    setSettlementDate(new Date().toISOString().split('T')[0]);
    try {
      setExistingLines(await fetchSettlementLines(row.id));
    } catch {
      setExistingLines([]);
    }
  }

  function openEdit(row: ExpenseAdvanceRow) {
    setEditing(row);
    setEditForm({
      date: row.date,
      person: row.person,
      amount: String(row.amount),
      notes: row.notes || '',
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const amount = Number(editForm.amount);
    if (!editForm.person.trim()) {
      toast.error('Person is required');
      return;
    }
    if (!(amount > 0)) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      await updateExpenseAdvance({
        id: editing.id,
        date: editForm.date,
        person: editForm.person,
        amount,
        notes: editForm.notes || null,
        settled: editing.settled,
        status: editing.status,
        source_expense_id: editing.source_expense_id,
      });
      toast.success('Expense advance updated');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ExpenseAdvanceRow) {
    const extra = row.settled > 0
      ? ` This will also remove ${formatCurrency(row.settled)} in settlement expenses.`
      : '';
    if (!confirm(`Delete expense advance for ${row.person} (${formatCurrency(row.amount)})?${extra}`)) {
      return;
    }
    try {
      await deleteExpenseAdvance(row);
      toast.success('Expense advance deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const lineTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remainingAfter = Math.max(0, Math.round(((settling?.remaining || 0) - lineTotal) * 100) / 100);

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!settling) return;
    if (lineTotal <= 0 && leftoverAction === 'keep_open') {
      toast.error('Add settlement lines or choose a leftover action');
      return;
    }
    if (lineTotal - settling.remaining > 0.01) {
      toast.error('Allocated amount exceeds remaining');
      return;
    }
    setSaving(true);
    try {
      await settleExpenseAdvance({
        advance: settling,
        lines,
        leftoverAction: remainingAfter > 0 ? leftoverAction : 'keep_open',
        settlementDate,
      });
      toast.success('Expense advance settled');
      setSettling(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setSaving(false);
    }
  }

  function renderStatus(row: ExpenseAdvanceRow) {
    if (row.status === 'Settled') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" /> Settled
        </span>
      );
    }
    if (row.status === 'Partial') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
          <Clock className="h-3 w-3" /> Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
        <Clock className="h-3 w-3" /> Open
      </span>
    );
  }

  function renderAgeBadge(row: ExpenseAdvanceRow) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'text-sm font-semibold',
            row.alert === 'overdue' && 'text-red-700',
            row.alert === 'warning' && 'text-amber-800',
            row.alert === 'ok' && 'text-gray-600',
          )}
        >
          {row.ageDays}d
        </span>
        {row.alert === 'warning' && (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500 border-0">
            <AlertTriangle className="h-3 w-3 mr-1" /> Warning
          </Badge>
        )}
        {row.alert === 'overdue' && (
          <Badge className="bg-red-600 text-white hover:bg-red-600 border-0">
            <AlertTriangle className="h-3 w-3 mr-1" /> Overdue
          </Badge>
        )}
      </div>
    );
  }

  function renderActions(row: ExpenseAdvanceRow, compact = false) {
    return (
      <div className={cn('flex items-center gap-1', compact ? 'w-full' : 'justify-end')}>
        {row.status !== 'Settled' && (
          <>
            <Button
              size="sm"
              variant="outline"
              className={compact ? 'flex-1' : undefined}
              onClick={() => openSettle(row)}
            >
              Settle
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} title="Delete">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Advances"
        actions={
          <Link
            href="/expenses"
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium bg-blue-600 text-white h-9 px-4 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add via Expenses
          </Link>
        }
      />

      <p className="text-sm text-gray-500 -mt-4">
        Issue a float from Expenses using category <span className="font-medium text-gray-700">{EXPENSE_ADVANCE_CATEGORY}</span>
        {' '}(driver or partner), then settle the breakup here. Warning after {EXPENSE_ADVANCE_WARNING_DAYS} days; overdue after {EXPENSE_ADVANCE_OVERDUE_DAYS} days.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Open / Partial</p>
            <p className="text-xl font-bold">{summary.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Cash with people</p>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.openAmount)}</p>
          </CardContent>
        </Card>
        <Card className={summary.warning ? 'border-amber-400 bg-amber-50' : ''}>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-amber-700">Warning (≥{EXPENSE_ADVANCE_WARNING_DAYS}d)</p>
            <p className="text-xl font-bold text-amber-800">{summary.warning}</p>
          </CardContent>
        </Card>
        <Card className={summary.overdue ? 'border-red-500 bg-red-50' : ''}>
          <CardContent className="py-3 px-4">
            <p className="text-xs font-medium text-red-700">Overdue (≥{EXPENSE_ADVANCE_OVERDUE_DAYS}d)</p>
            <p className="text-xl font-bold text-red-800">{summary.overdue}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {([
          ['open', 'Open'],
          ['all', 'All'],
          ['settled', 'Settled'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-md text-sm font-medium',
              filter === key ? 'bg-white shadow-sm text-gray-900 border' : 'text-gray-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">Loading...</CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500 text-sm">
              No expense advances. Add one from Expenses with category Expense Advance.
            </CardContent>
          </Card>
        ) : (
          visible.map((row) => (
            <Card
              key={row.id}
              className={cn(
                'overflow-hidden',
                row.alert === 'overdue' && 'border-red-400 bg-red-50',
                row.alert === 'warning' && 'border-amber-400 bg-amber-50',
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{row.person}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(row.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {renderStatus(row)}
                    {renderAgeBadge(row)}
                  </div>
                </div>

                {row.notes && (
                  <p className="text-sm text-gray-600 line-clamp-2">{row.notes}</p>
                )}

                <div className="grid grid-cols-3 gap-2 rounded-md bg-white/70 border border-black/5 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Given</p>
                    <p className="text-sm font-semibold mt-0.5">{formatCurrency(row.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Settled</p>
                    <p className="text-sm font-semibold text-green-700 mt-0.5">{formatCurrency(row.settled)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Left</p>
                    <p className="text-sm font-semibold text-amber-700 mt-0.5">{formatCurrency(row.remaining)}</p>
                  </div>
                </div>

                {renderActions(row, true)}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Given</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No expense advances. Add one from Expenses with category Expense Advance.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        row.alert === 'overdue' && 'bg-red-100 border-l-4 border-l-red-600 hover:bg-red-100/90',
                        row.alert === 'warning' && 'bg-amber-100 border-l-4 border-l-amber-500 hover:bg-amber-100/90',
                      )}
                    >
                      <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                      <TableCell className="font-medium">{row.person}</TableCell>
                      <TableCell className="max-w-[220px] text-sm text-gray-600 truncate" title={row.notes || undefined}>
                        {row.notes || '—'}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.amount)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-green-700">{formatCurrency(row.settled)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-amber-700">
                        {formatCurrency(row.remaining)}
                      </TableCell>
                      <TableCell>{renderAgeBadge(row)}</TableCell>
                      <TableCell>{renderStatus(row)}</TableCell>
                      <TableCell className="text-right">{renderActions(row)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Edit Expense Advance</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Person</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={editForm.person}
                  onChange={(e) => setEditForm((f) => ({ ...f, person: e.target.value }))}
                  required
                >
                  <option value="">Select</option>
                  {partners.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  {editForm.person && !partners.includes(editForm.person) && (
                    <option value={editForm.person}>{editForm.person}</option>
                  )}
                </select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={editing.settled > 0 ? editing.settled : 0.01}
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
                {editing.settled > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Already settled {formatCurrency(editing.settled)} — amount cannot go below that
                  </p>
                )}
              </div>
              <div>
                <Label>Note / description</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional note"
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!settling} onOpenChange={(o) => !o && setSettling(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Settle — {settling?.person}</DialogTitle>
          </DialogHeader>
          {settling && (
            <form onSubmit={handleSettle} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 rounded-md p-3">
                <div>
                  <p className="text-xs text-gray-500">Given</p>
                  <p className="font-semibold">{formatCurrency(settling.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Already settled</p>
                  <p className="font-semibold text-green-700">{formatCurrency(settling.settled)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className="font-semibold text-amber-700">{formatCurrency(settling.remaining)}</p>
                </div>
              </div>

              {existingLines.length > 0 && (
                <div className="text-sm space-y-1">
                  <p className="text-xs text-gray-500 uppercase">Previous breakup</p>
                  {existingLines.map((l) => (
                    <div key={l.id} className="flex justify-between text-gray-700">
                      <span>{l.category}</span>
                      <span>{formatCurrency(Number(l.amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label>Settlement date</Label>
                <Input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} required />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Breakup lines</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                    <Plus className="h-3 w-3 mr-1" /> Line
                  </Button>
                </div>
                {lines.map((line, idx) => {
                  const cats = categoriesByType[line.expense_type] || [];
                  return (
                    <div key={idx} className="border rounded-md p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <select
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                            value={line.expense_type}
                            onChange={(e) => {
                              const expense_type = e.target.value as ExpenseType;
                              setLines((prev) => prev.map((l, i) => i === idx ? { ...l, expense_type, category: '' } : l));
                            }}
                          >
                            {EXPENSE_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Category</Label>
                          <select
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                            value={line.category}
                            onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, category: e.target.value } : l))}
                          >
                            <option value="">Select</option>
                            {cats.filter((c) => !FLOAT_CATEGORIES.has(c) && c !== 'Advance').map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.amount || ''}
                            onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, amount: Number(e.target.value) } : l))}
                          />
                        </div>
                        {line.expense_type === 'vehicle' && (
                          <div>
                            <Label className="text-xs">Vehicle</Label>
                            <select
                              className="w-full border rounded-md px-2 py-1.5 text-sm"
                              value={line.vehicle_number || ''}
                              onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, vehicle_number: e.target.value } : l))}
                            >
                              <option value="">Select</option>
                              {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Note (optional)"
                          value={line.description || ''}
                          onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                        />
                        {lines.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-sm font-medium">
                <span>This settlement</span>
                <span>{formatCurrency(lineTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Left after</span>
                <span className="text-amber-700 font-medium">{formatCurrency(remainingAfter)}</span>
              </div>

              {remainingAfter > 0 && (
                <div>
                  <Label>Leftover ₹{remainingAfter.toFixed(0)}</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                    value={leftoverAction}
                    onChange={(e) => setLeftoverAction(e.target.value as LeftoverAction)}
                  >
                    <option value="keep_open">Keep as open expense advance</option>
                    <option value="salary_advance">Convert to salary advance</option>
                    <option value="returned">Mark as returned</option>
                  </select>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Saving...' : 'Save settlement'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
