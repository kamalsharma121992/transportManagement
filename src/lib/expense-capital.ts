import { EXPENSE_ADVANCE_CATEGORY } from '@/lib/supabase';
import { cardAssetDetails, type CreditCard } from '@/lib/credit-cards';

export type ExpenseCapitalInput = {
  date: string;
  amount: number;
  category: string;
  description: string | null;
  paymentSource: string;
  paidByPerson: string | null;
  paymentMode: string;
  cardId: number | null;
  card: CreditCard | undefined;
  cardDetails: string;
  cardHolder: string;
};

type LinkedCapital = {
  id: number;
  status: string | null;
};

const MISSING_LINK = /source_expense_id|schema cache/i;

export function expenseNeedsCapital(input: ExpenseCapitalInput): boolean {
  if (input.category === EXPENSE_ADVANCE_CATEGORY) return false;
  const useCard = input.paymentSource !== 'Revenue'
    && input.paymentMode === 'Credit Card'
    && input.cardId != null;
  return useCard || (input.paymentSource === 'Partner' && !!input.paidByPerson);
}

/** One unpaid row can be edited. A paid row, or a split bill, is left alone. */
export function capitalLinkAction(
  rows: { status: string | null }[],
  needsCapital: boolean,
): 'update' | 'insert' | 'delete' | 'settled' | 'none' {
  if (rows.some((row) => row.status === 'Paid') || rows.length > 1) return 'settled';
  if (needsCapital) return rows.length === 1 ? 'update' : 'insert';
  return rows.length === 1 ? 'delete' : 'none';
}

function capitalPayload(expenseId: number, input: ExpenseCapitalInput) {
  const useCard = input.paymentSource !== 'Revenue'
    && input.paymentMode === 'Credit Card'
    && input.cardId != null;
  return {
    date: input.date,
    contributor: useCard ? (input.card?.holder || input.cardHolder) : input.paidByPerson,
    contribution_type: input.paymentMode,
    value: Number(input.amount),
    description: input.description || input.category,
    asset_details: cardAssetDetails(input.card, input.cardDetails),
    card_id: useCard ? input.cardId : null,
    status: 'Unpaid',
    paid_by: 'JM transport',
    payment_source: null,
    source_expense_id: expenseId,
  };
}

async function linkedCapital(expenseId: number): Promise<LinkedCapital[] | 'missing-column'> {
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('capital_contributions')
    .select('id, status')
    .eq('source_expense_id', expenseId);
  if (error) {
    if (MISSING_LINK.test(error.message)) return 'missing-column';
    throw new Error(error.message);
  }
  return (data || []) as LinkedCapital[];
}

export function savedExpenseNeedsCapital(exp: {
  category: string;
  payment_source: string | null;
  paid_by_person: string | null;
  card_id: number | null;
}): boolean {
  if (exp.category === EXPENSE_ADVANCE_CATEGORY) return false;
  if (exp.card_id != null) return true;
  return exp.payment_source === 'Partner' && !!exp.paid_by_person;
}

export async function syncExpenseCapital(
  expenseId: number,
  input: ExpenseCapitalInput,
  options?: { createIfMissing?: boolean },
): Promise<'synced' | 'created' | 'removed' | 'settled' | 'none' | 'missing-column'> {
  const rows = await linkedCapital(expenseId);
  if (rows === 'missing-column') return 'missing-column';

  const action = capitalLinkAction(rows, expenseNeedsCapital(input));
  if (action === 'settled') return 'settled';
  if (action === 'none') return 'none';
  if (action === 'insert' && options?.createIfMissing === false) return 'none';

  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();

  if (action === 'delete') {
    const { error } = await supabase.from('capital_contributions').delete().eq('id', rows[0].id);
    if (error) throw new Error(error.message);
    return 'removed';
  }

  const payload = capitalPayload(expenseId, input);
  if (!payload.contributor) return 'none';

  if (action === 'update') {
    const { error } = await supabase.from('capital_contributions').update(payload).eq('id', rows[0].id);
    if (error) {
      if (MISSING_LINK.test(error.message)) return 'missing-column';
      throw new Error(error.message);
    }
    return 'synced';
  }

  const { error } = await supabase.from('capital_contributions').insert(payload);
  if (error) {
    if (MISSING_LINK.test(error.message)) return 'missing-column';
    throw new Error(error.message);
  }
  return 'created';
}

/** Remove an unpaid charge. A paid charge stays; deleting the expense clears its link. */
export async function releaseExpenseCapital(
  expenseId: number,
): Promise<'removed' | 'kept-paid' | 'none' | 'missing-column'> {
  const rows = await linkedCapital(expenseId);
  if (rows === 'missing-column') return 'missing-column';
  if (rows.length === 0) return 'none';

  const unpaidIds = rows.filter((row) => row.status !== 'Paid').map((row) => row.id);
  const keptPaid = rows.some((row) => row.status === 'Paid');
  if (unpaidIds.length > 0) {
    const { getSupabase } = await import('@/lib/supabase');
    const supabase = getSupabase();
    const { error } = await supabase.from('capital_contributions').delete().in('id', unpaidIds);
    if (error) throw new Error(error.message);
  }
  return keptPaid ? 'kept-paid' : 'removed';
}
