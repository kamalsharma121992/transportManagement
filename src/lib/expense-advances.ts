import {
  supabase,
  EXPENSE_ADVANCE_CATEGORY,
  DRIVER_PAY_CATEGORIES,
  type ExpenseAdvance,
  type ExpenseAdvanceStatus,
} from '@/lib/supabase';
import {
  EXPENSE_ADVANCE_OVERDUE_DAYS,
  EXPENSE_ADVANCE_WARNING_DAYS,
} from '@/lib/constants';

export type ExpenseAdvanceAlert = 'ok' | 'warning' | 'overdue';

export type ExpenseAdvanceSettlementLine = {
  expense_type: 'vehicle' | 'operational' | 'personal' | 'other';
  category: string;
  amount: number;
  vehicle_number?: string | null;
  description?: string | null;
};

export type LeftoverAction = 'keep_open' | 'salary_advance' | 'returned';

export type ExpenseAdvanceRow = ExpenseAdvance & {
  settled: number;
  remaining: number;
  ageDays: number;
  alert: ExpenseAdvanceAlert;
};

export function daysBetween(fromDate: string, toDate = new Date()): number {
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate);
  to.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

export function getExpenseAdvanceAlert(ageDays: number, status: ExpenseAdvanceStatus): ExpenseAdvanceAlert {
  if (status === 'Settled') return 'ok';
  if (ageDays >= EXPENSE_ADVANCE_OVERDUE_DAYS) return 'overdue';
  if (ageDays >= EXPENSE_ADVANCE_WARNING_DAYS) return 'warning';
  return 'ok';
}

/** Lightweight counts for nav badge / toast (open advances only). */
export async function fetchOpenExpenseAdvanceAlertCounts(): Promise<{
  overdue: number;
  warning: number;
}> {
  const { data, error } = await supabase
    .from('expense_advances')
    .select('date, status')
    .neq('status', 'Settled');

  if (error) throw error;

  let overdue = 0;
  let warning = 0;
  for (const row of data || []) {
    const alert = getExpenseAdvanceAlert(
      daysBetween(row.date),
      row.status as ExpenseAdvanceStatus,
    );
    if (alert === 'overdue') overdue += 1;
    else if (alert === 'warning') warning += 1;
  }
  return { overdue, warning };
}

export function deriveExpenseAdvanceStatus(amount: number, settled: number): ExpenseAdvanceStatus {
  if (settled <= 0) return 'Open';
  if (settled + 0.001 >= amount) return 'Settled';
  return 'Partial';
}

export async function fetchExpenseAdvances(): Promise<ExpenseAdvanceRow[]> {
  const { data, error } = await supabase
    .from('expense_advances')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw error;

  const rows = (data || []) as ExpenseAdvance[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: expRows, error: expErr } = await supabase
    .from('expenses')
    .select('expense_advance_id, amount, category')
    .in('expense_advance_id', ids);

  if (expErr) throw expErr;

  const settledMap = new Map<number, number>();
  for (const e of expRows || []) {
    if (!e.expense_advance_id) continue;
    if (e.category === EXPENSE_ADVANCE_CATEGORY) continue;
    settledMap.set(
      e.expense_advance_id,
      (settledMap.get(e.expense_advance_id) || 0) + Number(e.amount),
    );
  }

  const enriched: ExpenseAdvanceRow[] = rows.map((row) => {
    const settled = settledMap.get(row.id) || 0;
    const derived = deriveExpenseAdvanceStatus(Number(row.amount), settled);
    const status: ExpenseAdvanceStatus = row.status === 'Settled' ? 'Settled' : derived;
    const remaining =
      status === 'Settled'
        ? 0
        : Math.max(0, Math.round((Number(row.amount) - settled) * 100) / 100);
    const ageDays = daysBetween(row.date);
    return {
      ...row,
      amount: Number(row.amount),
      settled: Math.round(settled * 100) / 100,
      remaining,
      status,
      ageDays,
      alert: getExpenseAdvanceAlert(ageDays, status),
    };
  });

  const statusUpdates = enriched.filter((r) => {
    const original = rows.find((d) => d.id === r.id);
    return original && original.status !== r.status && r.status !== 'Settled';
  });
  await Promise.all(
    statusUpdates.map((r) =>
      supabase.from('expense_advances').update({ status: r.status }).eq('id', r.id),
    ),
  );

  enriched.sort((a, b) => {
    const rank = { overdue: 0, warning: 1, ok: 2 };
    if (a.status === 'Settled' && b.status !== 'Settled') return 1;
    if (b.status === 'Settled' && a.status !== 'Settled') return -1;
    if (rank[a.alert] !== rank[b.alert]) return rank[a.alert] - rank[b.alert];
    return b.date.localeCompare(a.date) || b.id - a.id;
  });

  return enriched;
}

/** Called after saving an Expense Advance from the expenses form. */
export async function createExpenseAdvanceFromExpense(expense: {
  id: number;
  date: string;
  amount: number;
  person: string | null;
  description?: string | null;
}): Promise<void> {
  if (!expense.person?.trim()) {
    throw new Error('Person is required for Expense Advance');
  }

  const { data: existing } = await supabase
    .from('expense_advances')
    .select('id')
    .eq('source_expense_id', expense.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('expense_advances')
      .update({
        date: expense.date,
        person: expense.person.trim(),
        amount: Number(expense.amount),
        notes: expense.description || null,
      })
      .eq('id', existing.id);
    await supabase.from('expenses').update({ expense_advance_id: existing.id }).eq('id', expense.id);
    return;
  }

  const { data, error } = await supabase
    .from('expense_advances')
    .insert({
      date: expense.date,
      person: expense.person.trim(),
      amount: Number(expense.amount),
      notes: expense.description || null,
      status: 'Open',
      source_expense_id: expense.id,
    })
    .select('id')
    .single();

  if (error) throw error;
  await supabase.from('expenses').update({ expense_advance_id: data.id }).eq('id', expense.id);
}

export async function fetchSettlementLines(expenseAdvanceId: number) {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, date, expense_type, category, amount, vehicle_number, description')
    .eq('expense_advance_id', expenseAdvanceId)
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return (data || []).filter((e) => e.category !== EXPENSE_ADVANCE_CATEGORY);
}

export async function updateExpenseAdvance(params: {
  id: number;
  date: string;
  person: string;
  amount: number;
  notes: string | null;
  settled: number;
  status: ExpenseAdvanceStatus;
  source_expense_id: number | null;
}): Promise<void> {
  const person = params.person.trim();
  if (!person) throw new Error('Person is required');
  if (!(params.amount > 0)) throw new Error('Amount must be positive');
  if (params.amount + 0.001 < params.settled) {
    throw new Error(`Amount cannot be less than already settled ₹${params.settled}`);
  }

  const status: ExpenseAdvanceStatus =
    params.status === 'Settled'
      ? 'Settled'
      : deriveExpenseAdvanceStatus(params.amount, params.settled);

  const { error } = await supabase
    .from('expense_advances')
    .update({
      date: params.date,
      person,
      amount: params.amount,
      notes: params.notes?.trim() || null,
      status,
    })
    .eq('id', params.id);

  if (error) throw error;

  if (params.source_expense_id) {
    const { error: expErr } = await supabase
      .from('expenses')
      .update({
        date: params.date,
        amount: params.amount,
        person,
        description: params.notes?.trim() || null,
      })
      .eq('id', params.source_expense_id);
    if (expErr) throw expErr;
  }
}

/** Deletes the advance, its source float expense, and any settlement expense lines. */
export async function deleteExpenseAdvance(advance: ExpenseAdvanceRow): Promise<void> {
  const { error: linkedErr } = await supabase
    .from('expenses')
    .delete()
    .eq('expense_advance_id', advance.id);
  if (linkedErr) throw linkedErr;

  if (advance.source_expense_id) {
    const { error: srcErr } = await supabase
      .from('expenses')
      .delete()
      .eq('id', advance.source_expense_id);
    if (srcErr) throw srcErr;
  }

  const { error } = await supabase.from('expense_advances').delete().eq('id', advance.id);
  if (error) throw error;
}

export async function settleExpenseAdvance(params: {
  advance: ExpenseAdvanceRow;
  lines: ExpenseAdvanceSettlementLine[];
  leftoverAction: LeftoverAction;
  settlementDate: string;
}): Promise<void> {
  const { advance, lines, leftoverAction, settlementDate } = params;
  const validLines = lines.filter((l) => l.category && Number(l.amount) > 0);
  const lineTotal = validLines.reduce((s, l) => s + Number(l.amount), 0);

  if (lineTotal - advance.remaining > 0.01) {
    throw new Error(`Allocated ₹${lineTotal} exceeds remaining ₹${advance.remaining}`);
  }

  for (const line of validLines) {
    const { error } = await supabase.from('expenses').insert({
      date: settlementDate,
      expense_type: line.expense_type,
      category: line.category,
      amount: Number(line.amount),
      vehicle_number: line.expense_type === 'vehicle' ? (line.vehicle_number || null) : null,
      description: line.description || `Settled from Expense Advance #${advance.id}`,
      person: advance.person,
      paid_by: 'JM transport',
      status: 'Paid',
      payment_source: 'Partner',
      expense_advance_id: advance.id,
    });
    if (error) throw error;
  }

  let remaining = Math.max(0, Math.round((advance.remaining - lineTotal) * 100) / 100);

  if (remaining > 0 && leftoverAction === 'salary_advance') {
    const { error } = await supabase.from('expenses').insert({
      date: settlementDate,
      expense_type: 'operational',
      category: DRIVER_PAY_CATEGORIES.advance,
      amount: remaining,
      description: `Converted from Expense Advance #${advance.id}`,
      person: advance.person,
      paid_by: 'JM transport',
      status: 'Paid',
      payment_source: 'Partner',
      expense_advance_id: advance.id,
    });
    if (error) throw error;
    remaining = 0;
  }

  let status: ExpenseAdvanceStatus;
  let notes = advance.notes;

  if (leftoverAction === 'returned') {
    status = 'Settled';
    notes = [advance.notes, `Returned leftover ₹${remaining} on ${settlementDate}`]
      .filter(Boolean)
      .join(' · ');
    remaining = 0;
  } else if (leftoverAction === 'salary_advance' || remaining <= 0) {
    status = 'Settled';
  } else {
    status = deriveExpenseAdvanceStatus(advance.amount, advance.amount - remaining);
  }

  const { error: updErr } = await supabase
    .from('expense_advances')
    .update({ status, notes })
    .eq('id', advance.id);

  if (updErr) throw updErr;
}
