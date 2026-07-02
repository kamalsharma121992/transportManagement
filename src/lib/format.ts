export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getMonthFilterOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'All months' }];
  const now = new Date();
  const start = new Date(now.getFullYear() - 2, 0, 1);
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor >= start) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const label = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value, label });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return options;
}

/** Local calendar month bounds (YYYY-MM-DD). Avoids UTC shift from toISOString(). */
export function getMonthDateRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-');
  const year = Number(y);
  const monthNum = Number(m);
  const from = `${y}-${m}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export const FILTER_SELECT_CLASS =
  'w-full min-w-0 border rounded-md px-3 py-2 text-sm bg-white';
