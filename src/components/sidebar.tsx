'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Truck,
  Route,
  Receipt,
  FilePlus,
  Landmark,
  FileBarChart,
  Wallet,
  HandCoins,
  Settings,
  CreditCard,
  ScrollText,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { logout, useSession } from '@/components/session-provider';
import { sessionCanOpen } from '@/lib/auth/pages';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { href: '/trips', label: 'Trip Log', icon: Route, page: 'trips' },
  { href: '/expenses', label: 'Expenses', icon: Receipt, page: 'expenses' },
  { href: '/expense-advances', label: 'Expense Advances', icon: HandCoins, page: 'expense-advances' },
  { href: '/vehicles', label: 'Vehicles', icon: Truck, page: 'vehicles' },
  { href: '/capital', label: 'Capital', icon: Landmark, page: 'capital' },
  { href: '/credit-cards', label: 'Credit Cards', icon: CreditCard, page: 'credit-cards' },
  { href: '/reports', label: 'Reports', icon: FileBarChart, page: 'reports' },
  { href: '/payroll', label: 'Payroll', icon: Wallet, page: 'payroll' },
  { href: '/admin', label: 'Admin', icon: Settings, page: 'admin' },
];

function formatBadgeCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}

export function Sidebar({
  overdueCount = 0,
  warningCount = 0,
  tripOverdueCount = 0,
  cardBillCount = 0,
}: {
  overdueCount?: number;
  warningCount?: number;
  tripOverdueCount?: number;
  cardBillCount?: number;
}) {
  const pathname = usePathname();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter(item => session && sessionCanOpen(session.pages, item.page));
  const canAudit = !!session && sessionCanOpen(session.pages, 'audit');
  const canSubmit = !!session && sessionCanOpen(session.pages, 'submit');
  const mobileBadgeCount = overdueCount > 0
    ? overdueCount
    : tripOverdueCount > 0
      ? tripOverdueCount
      : cardBillCount > 0
        ? cardBillCount
        : warningCount;
  const mobileBadgeIsOverdue = overdueCount > 0 || tripOverdueCount > 0;

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-white rounded-lg p-2 shadow-md"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
        {mobileBadgeCount > 0 && !open && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              mobileBadgeIsOverdue ? 'bg-red-600' : 'bg-amber-500',
            )}
          >
            {mobileBadgeCount > 9 ? '9+' : mobileBadgeCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 flex h-full w-64 flex-col bg-white border-r shadow-sm transition-transform md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900 truncate">{session?.name || 'JM Transport'}</h1>
          <p className="text-xs text-gray-500 mt-1 truncate">{session ? `${session.role} · ${session.username}` : 'Truck Management'}</p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-4 space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const isAdvances = item.href === '/expense-advances';
            const isTrips = item.href === '/trips';
            const isCards = item.href === '/credit-cards';
            const showOverdue = isAdvances && overdueCount > 0;
            const showWarning = isAdvances && warningCount > 0;
            const showTripOverdue = isTrips && tripOverdueCount > 0;
            const showCardBills = isCards && cardBillCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  showOverdue && !isActive && 'bg-red-50 text-red-800 hover:bg-red-100',
                  !showOverdue && showWarning && !isActive && 'bg-amber-50 text-amber-900 hover:bg-amber-100',
                  showTripOverdue && !isActive && 'bg-red-50 text-red-800 hover:bg-red-100',
                  showCardBills && !isActive && 'bg-amber-50 text-amber-900 hover:bg-amber-100',
                )}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {(showOverdue || showWarning) && (
                  <span className="inline-flex items-center gap-1">
                    {showWarning && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                        {formatBadgeCount(warningCount)}
                      </span>
                    )}
                    {showOverdue && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                        {formatBadgeCount(overdueCount)}
                      </span>
                    )}
                  </span>
                )}
                {showTripOverdue && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                    {formatBadgeCount(tripOverdueCount)}
                  </span>
                )}
                {showCardBills && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                    {formatBadgeCount(cardBillCount)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-1 border-t p-3">
          {canSubmit && (
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                pathname === '/submit'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50',
              )}
            >
              <FilePlus size={18} />
              Submit expense
            </Link>
          )}
          {canAudit && (
            <Link
              href="/audit"
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/audit'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <ScrollText size={18} />
              Audit log
            </Link>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
