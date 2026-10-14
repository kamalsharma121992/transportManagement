export const APP_PAGES = [
  { key: 'dashboard', href: '/', label: 'Dashboard' },
  { key: 'trips', href: '/trips', label: 'Trip Log' },
  { key: 'routes', href: '/routes', label: 'Routes' },
  { key: 'expenses', href: '/expenses', label: 'Expenses' },
  { key: 'expense-advances', href: '/expense-advances', label: 'Expense Advances' },
  { key: 'vehicles', href: '/vehicles', label: 'Vehicles' },
  { key: 'capital', href: '/capital', label: 'Capital' },
  { key: 'credit-cards', href: '/credit-cards', label: 'Credit Cards' },
  { key: 'reports', href: '/reports', label: 'Reports' },
  { key: 'payroll', href: '/payroll', label: 'Payroll' },
  { key: 'submit', href: '/submit', label: 'Submit expense' },
  { key: 'admin', href: '/admin', label: 'Admin' },
  { key: 'audit', href: '/audit', label: 'Audit log' },
] as const;

export type AppPageKey = (typeof APP_PAGES)[number]['key'];

export function pageKeyForPath(pathname: string): AppPageKey | null {
  if (pathname === '/') return 'dashboard';
  const match = APP_PAGES.find((page) => page.href !== '/' && (pathname === page.href || pathname.startsWith(page.href + '/')));
  return match?.key ?? null;
}

export function hrefForPage(key: string): string {
  return APP_PAGES.find((page) => page.key === key)?.href ?? '/';
}

const HOME_ORDER = APP_PAGES.map((page) => page.key);

export function homeForPages(pages: string[]): string {
  const key = HOME_ORDER.find((page) => pages.includes(page)) ?? pages[0];
  return hrefForPage(key || 'dashboard');
}

export function sessionCanOpen(pages: string[], key: string): boolean {
  if (pages.includes(key)) return true;
  return pages.includes('admin') && (key === 'routes' || key === 'audit');
}
