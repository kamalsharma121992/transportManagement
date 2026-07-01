export type CardNetwork = 'VISA' | 'Mastercard' | 'RuPay';

export type CreditCard = {
  id: number;
  holder: string;
  bank_name: string;
  network: string;
  last_four: string;
  label: string;
  is_active: boolean;
};

export const CARD_NETWORKS: CardNetwork[] = ['VISA', 'Mastercard', 'RuPay'];

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
    .select('id, holder, bank_name, network, last_four, label, is_active')
    .order('holder')
    .order('bank_name')
    .order('network');

  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;

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
