import { formatCurrency } from '@/lib/format';
import { EXPENSE_ADVANCE_CATEGORY } from '@/lib/supabase';

export type CreditCard = {
  id: number;
  holder: string;
  bank_name: string;
  network: string;
  last_four: string;
  label: string;
  is_active: boolean;
  bill_generate_day: number | null;
  bill_pay_day: number | null;
};

export type CardNetwork = 'VISA' | 'Mastercard' | 'RuPay';

export const CARD_NETWORKS: CardNetwork[] = ['VISA', 'Mastercard', 'RuPay'];

/** Show a notice when the bill generates within this many days. */
export const CARD_BILL_NOTICE_DAYS = 2;

const CARD_SELECT =
  'id, holder, bank_name, network, last_four, label, is_active, bill_generate_day, bill_pay_day';

const CARD_SELECT_LEGACY =
  'id, holder, bank_name, network, last_four, label, is_active';

export function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function clampDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, last);
}

/** Days until the next occurrence of a day-of-month. 0 means today. */
export function daysUntilDayOfMonth(day: number, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let year = start.getFullYear();
  let month = start.getMonth();
  let target = new Date(year, month, clampDay(year, month, day));
  if (target < start) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    target = new Date(year, month, clampDay(year, month, day));
  }
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export type CardBillNotice = {
  card: CreditCard;
  daysUntil: number;
  /** Spend on this card in the current cycle, including amounts moved from another partner's bill. */
  amount: number;
  /** Already marked paid in Capital for this cycle. */
  paid: number;
};

export const CARD_PAYMENT_TYPE = 'Card Payment';

export function billLeft(notice: { amount: number; paid?: number }): number {
  const left = (notice.amount || 0) - (notice.paid || 0);
  return left > 0 ? Math.round(left * 100) / 100 : 0;
}

export function cardBillNotices(cards: CreditCard[], today = new Date()): CardBillNotice[] {
  return cards
    .filter((card) => card.is_active && card.bill_generate_day != null)
    .map((card) => ({
      card,
      daysUntil: daysUntilDayOfMonth(card.bill_generate_day as number, today),
      amount: 0,
      paid: 0,
    }))
    .filter((notice) => notice.daysUntil <= CARD_BILL_NOTICE_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.card.label.localeCompare(b.card.label));
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Upcoming statement date for a day-of-month. */
export function upcomingStatementDate(day: number, today = new Date()): Date {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() + daysUntilDayOfMonth(day, today));
  return start;
}

/** Charges after the previous statement date, through this statement date. */
export function billCycle(generateDay: number, today = new Date()): { from: string; to: string } {
  const statement = upcomingStatementDate(generateDay, today);
  const prevMonth = new Date(statement.getFullYear(), statement.getMonth() - 1, 1);
  const prev = new Date(
    prevMonth.getFullYear(),
    prevMonth.getMonth(),
    clampDay(prevMonth.getFullYear(), prevMonth.getMonth(), generateDay),
  );
  const from = new Date(prev);
  from.setDate(from.getDate() + 1);
  return { from: isoDate(from), to: isoDate(statement) };
}

export async function withGeneratedAmounts(notices: CardBillNotice[]): Promise<CardBillNotice[]> {
  if (notices.length === 0) return [];
  const cycles = notices.map((notice) => ({
    id: notice.card.id,
    ...billCycle(notice.card.bill_generate_day as number),
  }));
  const from = cycles.reduce((min, cycle) => (cycle.from < min ? cycle.from : min), cycles[0].from);
  const to = cycles.reduce((max, cycle) => (cycle.to > max ? cycle.to : max), cycles[0].to);

  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('expenses')
    .select('card_id, amount, date, category')
    .in('card_id', cycles.map((cycle) => cycle.id))
    .gte('date', from)
    .lte('date', to);

  if (error) return notices;

  return notices.map((notice) => {
    const cycle = cycles.find((item) => item.id === notice.card.id);
    if (!cycle) return notice;
    const amount = (data || [])
      .filter((row) =>
        row.card_id === notice.card.id
        && row.date >= cycle.from
        && row.date <= cycle.to
        && row.category !== EXPENSE_ADVANCE_CATEGORY,
      )
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return { ...notice, amount, paid: notice.paid || 0 };
  });
}

type CycleCapitalRow = {
  card_id: number | null;
  value: number;
  date: string;
  paid_date: string | null;
  contribution_type: string;
  status: string;
};

function inCycle(date: string | null | undefined, cycle: { from: string; to: string }): boolean {
  return !!date && date >= cycle.from && date <= cycle.to;
}

export async function withCardSettlement(notices: CardBillNotice[]): Promise<CardBillNotice[]> {
  if (notices.length === 0) return [];
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('capital_contributions')
    .select('card_id, value, date, paid_date, contribution_type, status')
    .in('card_id', notices.map((notice) => notice.card.id));

  if (error) return notices.map((notice) => ({ ...notice, paid: notice.paid || 0 }));

  const rows = (data || []) as CycleCapitalRow[];
  return notices.map((notice) => {
    if (!notice.card.bill_generate_day) return { ...notice, paid: 0 };
    const cycle = billCycle(notice.card.bill_generate_day);
    const mine = rows.filter((row) => row.card_id === notice.card.id);
    const movedIn = mine
      .filter((row) => row.contribution_type === CARD_PAYMENT_TYPE && inCycle(row.date, cycle))
      .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    const paid = mine
      .filter((row) => row.status === 'Paid' && row.contribution_type !== CARD_PAYMENT_TYPE && inCycle(row.contribution_type === 'Payout' ? (row.paid_date || row.date) : row.date, cycle))
      .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    const movedPaid = mine
      .filter((row) => row.contribution_type === CARD_PAYMENT_TYPE && row.status === 'Paid' && inCycle(row.date, cycle))
      .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    return {
      ...notice,
      amount: Math.round((notice.amount + movedIn) * 100) / 100,
      paid: Math.round((paid + movedPaid) * 100) / 100,
    };
  });
}

export async function enrichBillNotices(notices: CardBillNotice[]): Promise<CardBillNotice[]> {
  return withCardSettlement(await withGeneratedAmounts(notices));
}

export async function settleCardCapital(params: {
  cardId: number;
  amount: number;
  date: string;
  contributor: string;
  paymentSource: string;
  description: string;
  payerCardId?: number | null;
}): Promise<void> {
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('capital_contributions')
    .select('id, date, contributor, contribution_type, value, description, asset_details, card_id')
    .eq('card_id', params.cardId)
    .neq('status', 'Paid')
    .neq('contribution_type', 'Payout')
    .order('date', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);

  const { data: billCard } = await supabase
    .from('credit_cards')
    .select('bill_generate_day')
    .eq('id', params.cardId)
    .maybeSingle();
  const cycle = billCard?.bill_generate_day ? billCycle(billCard.bill_generate_day) : null;
  const ordered = [...(rows || [])].sort((a, b) => {
    const aIn = cycle && a.date >= cycle.from && a.date <= cycle.to ? 0 : 1;
    const bIn = cycle && b.date >= cycle.from && b.date <= cycle.to ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id - b.id;
  });

  let remaining = Math.round(params.amount * 100) / 100;
  for (const row of ordered) {
    if (remaining <= 0) break;
    const value = Number(row.value) || 0;
    const paidFields = {
      status: 'Paid',
      paid_date: params.date,
      paid_by: 'JM transport',
      payment_source: params.paymentSource,
    };
    if (value <= remaining + 0.009) {
      const { error: updateError } = await supabase.from('capital_contributions').update(paidFields).eq('id', row.id);
      if (updateError) throw new Error(updateError.message);
      remaining = Math.round((remaining - value) * 100) / 100;
    } else {
      const { error: updateError } = await supabase.from('capital_contributions').update({
        ...paidFields,
        value: remaining,
      }).eq('id', row.id);
      if (updateError) throw new Error(updateError.message);
      const leftover = Math.round((value - remaining) * 100) / 100;
      const { error: insertError } = await supabase.from('capital_contributions').insert({
        date: row.date,
        contributor: row.contributor,
        contribution_type: row.contribution_type,
        value: leftover,
        description: row.description,
        asset_details: row.asset_details,
        card_id: row.card_id,
        status: 'Unpaid',
        paid_date: null,
        paid_by: 'JM transport',
        payment_source: null,
      });
      if (insertError) throw new Error(insertError.message);
      remaining = 0;
    }
  }

  if (remaining > 0) {
    const { error: payoutError } = await supabase.from('capital_contributions').insert({
      date: params.date,
      contributor: params.contributor,
      contribution_type: 'Payout',
      value: remaining,
      description: params.description || 'Card bill',
      status: 'Paid',
      paid_date: params.date,
      paid_by: 'JM transport',
      payment_source: params.paymentSource,
      card_id: params.cardId,
    });
    if (payoutError) throw new Error(payoutError.message);
  }

  if (params.payerCardId && params.payerCardId !== params.cardId) {
    const { data: payerCard, error: cardError } = await supabase
      .from('credit_cards')
      .select('id, holder, label')
      .eq('id', params.payerCardId)
      .maybeSingle();
    if (cardError) throw new Error(cardError.message);
    if (payerCard) {
      const { error: transferError } = await supabase.from('capital_contributions').insert({
        date: params.date,
        contributor: payerCard.holder,
        contribution_type: CARD_PAYMENT_TYPE,
        value: Math.round(params.amount * 100) / 100,
        description: params.description || `Paid ${params.contributor} card bill`,
        status: 'Unpaid',
        paid_date: null,
        paid_by: 'JM transport',
        payment_source: null,
        card_id: payerCard.id,
      });
      if (transferError) throw new Error(transferError.message);
    }
  }
}

export type CardBillRow = {
  card: CreditCard;
  daysUntil: number | null;
  amount: number;
  paid: number;
  dueSoon: boolean;
  cycleFrom: string | null;
  cycleTo: string | null;
};

export async function fetchCardBillRows(): Promise<CardBillRow[]> {
  const { data } = await fetchCreditCards(false);
  const tracked = data
    .filter((card) => card.bill_generate_day != null)
    .map((card) => ({
      card,
      daysUntil: daysUntilDayOfMonth(card.bill_generate_day as number),
      amount: 0,
      paid: 0,
    }));
  const enriched = await enrichBillNotices(tracked);
  const byId = new Map(enriched.map((notice) => [notice.card.id, notice]));

  return data
    .map((card) => {
      const notice = byId.get(card.id);
      const daysUntil = card.bill_generate_day != null
        ? daysUntilDayOfMonth(card.bill_generate_day)
        : null;
      const cycle = card.bill_generate_day != null ? billCycle(card.bill_generate_day) : null;
      return {
        card,
        daysUntil,
        amount: notice?.amount ?? 0,
        paid: notice?.paid ?? 0,
        dueSoon: card.is_active && daysUntil != null && daysUntil <= CARD_BILL_NOTICE_DAYS,
        cycleFrom: cycle?.from ?? null,
        cycleTo: cycle?.to ?? null,
      };
    })
    .sort((a, b) => {
      if (a.dueSoon !== b.dueSoon) return a.dueSoon ? -1 : 1;
      if (a.daysUntil == null) return 1;
      if (b.daysUntil == null) return -1;
      return a.daysUntil - b.daysUntil || a.card.label.localeCompare(b.card.label);
    });
}

export function capitalPayHref(notice: CardBillNotice): string {
  const params = new URLSearchParams({
    pay: '1',
    to: notice.card.holder,
    amount: String(billLeft(notice) || 0),
    note: `${formatCardLabel(notice.card)} bill`,
    card: String(notice.card.id),
  });
  return `/capital?${params.toString()}`;
}

export function billNoticeText(notice: CardBillNotice): string {
  const when = notice.daysUntil === 0
    ? 'today'
    : notice.daysUntil === 1
      ? 'tomorrow'
      : `in ${notice.daysUntil} days`;
  const pay = notice.card.bill_pay_day
    ? ` Pay by the ${ordinalDay(notice.card.bill_pay_day)}.`
    : '';
  const generated = ` Generated ${formatCurrency(notice.amount)}. Paid ${formatCurrency(notice.paid || 0)}. Left ${formatCurrency(billLeft(notice))}.`;
  return `${notice.card.label} bill generates ${when}.${generated}${pay}`;
}

export function buildCardLabel(
  bankName: string,
  network: string,
  holder: string,
  lastFour = '',
): string {
  const suffix = lastFour ? ` •••• ${lastFour}` : '';
  return `${bankName.trim()} ${network.trim()}${suffix} - ${holder.trim()}`;
}

export function formatCardLabel(
  card: Pick<CreditCard, 'bank_name' | 'network' | 'last_four'>,
): string {
  const suffix = card.last_four ? ` •••• ${card.last_four}` : '';
  return `${card.bank_name} ${card.network}${suffix}`;
}

export function formatCardOption(card: CreditCard): string {
  return `${formatCardLabel(card)} (${card.holder})`;
}

export function cardAssetDetails(
  card: CreditCard | undefined,
  legacyText: string,
): string | null {
  if (card) return formatCardLabel(card);
  const trimmed = legacyText.trim();
  return trimmed || null;
}

export async function fetchCreditCards(activeOnly = true): Promise<{
  data: CreditCard[];
  error: string | null;
  tableMissing: boolean;
}> {
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();

  let query = supabase
    .from('credit_cards')
    .select(CARD_SELECT)
    .order('holder')
    .order('bank_name')
    .order('network');

  if (activeOnly) query = query.eq('is_active', true);

  let { data, error } = await query;

  if (error && /bill_generate_day|bill_pay_day|schema cache/i.test(error.message)) {
    let legacy = supabase
      .from('credit_cards')
      .select(CARD_SELECT_LEGACY)
      .order('holder')
      .order('bank_name')
      .order('network');
    if (activeOnly) legacy = legacy.eq('is_active', true);
    const fallback = await legacy;
    data = (fallback.data || []).map((row) => ({
      ...row,
      bill_generate_day: null,
      bill_pay_day: null,
    }));
    error = fallback.error;
  }

  if (error) {
    const tableMissing =
      error.message.includes('credit_cards') || error.message.includes('schema cache');
    return { data: [], error: tableMissing ? null : error.message, tableMissing };
  }

  return { data: (data as CreditCard[]) || [], error: null, tableMissing: false };
}

export function filterCardsByHolder(cards: CreditCard[], holder: string): CreditCard[] {
  if (!holder) return cards;
  return cards.filter((c) => c.holder === holder);
}
