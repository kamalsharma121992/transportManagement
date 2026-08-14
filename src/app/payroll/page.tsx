'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  computeIfLeavesTodayPay,
  computePayrollTotals,
  fetchInactiveDrivers,
  fetchInactivePayroll,
  fetchMonthlyPayroll,
  getEmploymentDaysInMonth,
  periodPickerBounds,
  getSuggestedPayrollMonth,
  postAdvance,
  postDailyAllowance,
  postSalary,
  revertLastAllowance,
  revertSalary,
  type DriverLeaveEntry,
  setDriverLeaveDates,
  setPayrollPeriod,
  type MonthlyPayrollRow,
} from '@/lib/driver-payroll';
import type { Driver } from '@/lib/supabase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Check, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type Tab = 'active' | 'inactive';

type DisplayRow = MonthlyPayrollRow & { gross: number; balance: number };

function getPayStatus(row: DisplayRow): { label: string; className: string } {
  const needsAllowance = row.allowanceShortfall > 0.01;
  const needsSalary = row.salaryPaid <= 0 && row.salaryDue > 0.01;
  if (!needsAllowance && !needsSalary && row.balance <= 0.01) {
    return { label: 'Settled', className: 'bg-green-100 text-green-800' };
  }
  if (needsAllowance || needsSalary) {
    return { label: 'Needs pay', className: 'bg-amber-100 text-amber-900' };
  }
  return { label: 'In progress', className: 'bg-sky-100 text-sky-800' };
}

export default function PayrollPage() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const [tab, setTab] = useState<Tab>('active');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonthlyPayrollRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<MonthlyPayrollRow[]>([]);
  const [inactiveDrivers, setInactiveDrivers] = useState<Driver[]>([]);
  const [salaryInputs, setSalaryInputs] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [allowanceDialog, setAllowanceDialog] = useState<{
    row: MonthlyPayrollRow;
    date: string;
    days: string;
    amount: string;
  } | null>(null);
  const [advanceDialog, setAdvanceDialog] = useState<{
    driverName: string;
    date: string;
    amount: string;
    description: string;
  } | null>(null);
  const [posting, setPosting] = useState<string | null>(null);
  const [leaveDialog, setLeaveDialog] = useState<{
    row: MonthlyPayrollRow;
    leaveByDate: Map<string, boolean>;
    deductNewLeaveFromSalary: boolean;
  } | null>(null);
  const [periodDialog, setPeriodDialog] = useState<{
    row: MonthlyPayrollRow;
    startDate: string;
    endDate: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [data, inactiveData, inactiveList] = await Promise.all([
        fetchMonthlyPayroll(selectedMonth),
        fetchInactivePayroll(selectedMonth),
        fetchInactiveDrivers(),
      ]);
      setRows(data);
      setInactiveRows(inactiveData);
      setInactiveDrivers(inactiveList);
      const inputs: Record<string, string> = {};
      for (const r of [...data, ...inactiveData]) {
        inputs[r.driver.name] = r.salaryPaid > 0 ? String(r.salaryPaid) : String(r.salaryDue);
      }
      setSalaryInputs(inputs);
    } catch {
      toast.error('Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setExpandedDriver(null);
    load();
  }, [selectedMonth]);

  function openAllowanceDialog(row: MonthlyPayrollRow) {
    const days = row.daysShortfall > 0 ? String(Math.min(row.daysShortfall, 2)) : '1';
    const amount = String(Number(days) * row.dailyRate);
    setAllowanceDialog({
      row,
      date: today,
      days,
      amount,
    });
  }

  function updateAllowanceDays(days: string, dailyRate: number) {
    const n = Math.max(1, Number(days) || 1);
    setAllowanceDialog((prev) =>
      prev ? { ...prev, days: String(n), amount: String(n * dailyRate) } : null,
    );
  }

  async function handlePostAllowance() {
    if (!allowanceDialog) return;
    const days = Number(allowanceDialog.days);
    const amount = Number(allowanceDialog.amount);
    if (!days || days < 1 || !amount || amount <= 0) {
      toast.error('Enter valid days and amount');
      return;
    }
    const key = `allowance-${allowanceDialog.row.driver.name}`;
    setPosting(key);
    try {
      await postDailyAllowance(
        allowanceDialog.row.driver,
        allowanceDialog.date,
        days,
        amount,
      );
      toast.success(`Allowance posted for ${allowanceDialog.row.driver.name}`);
      setAllowanceDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post allowance');
    } finally {
      setPosting(null);
    }
  }

  async function handlePostSalary(row: MonthlyPayrollRow) {
    const amount = Number(salaryInputs[row.driver.name]);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid salary amount');
      return;
    }
    const key = `salary-${row.driver.name}`;
    setPosting(key);
    try {
      await postSalary(row.driver, selectedMonth, amount);
      toast.success(`Salary posted for ${row.driver.name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post salary');
    } finally {
      setPosting(null);
    }
  }

  async function handleRevertSalary(row: MonthlyPayrollRow) {
    if (!confirm(`Remove salary expense for ${row.driver.name} in ${selectedMonth}?`)) return;
    setPosting(`revert-salary-${row.driver.name}`);
    try {
      await revertSalary(row.driver.name, selectedMonth, {
        from: row.periodStart,
        to: row.periodEnd,
      });
      toast.success(`Salary reverted for ${row.driver.name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revert salary');
    } finally {
      setPosting(null);
    }
  }

  async function handleRevertLastAllowance(row: MonthlyPayrollRow) {
    if (!confirm(`Remove the last allowance payment for ${row.driver.name} in ${selectedMonth}?`)) return;
    setPosting(`revert-allowance-${row.driver.name}`);
    try {
      await revertLastAllowance(row.driver.name, selectedMonth, {
        from: row.periodStart,
        to: row.periodEnd,
      });
      toast.success(`Last allowance reverted for ${row.driver.name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revert allowance');
    } finally {
      setPosting(null);
    }
  }

  function openPeriodDialog(row: MonthlyPayrollRow) {
    setPeriodDialog({
      row,
      startDate: row.periodStart,
      endDate: row.periodEnd,
    });
  }

  async function handleSavePeriod() {
    if (!periodDialog) return;
    if (periodDialog.startDate > periodDialog.endDate) {
      toast.error('Start date must be on or before end date');
      return;
    }
    setPosting('period');
    try {
      await setPayrollPeriod(
        periodDialog.row.driver.name,
        selectedMonth,
        periodDialog.startDate,
        periodDialog.endDate,
      );
      toast.success(`Period saved for ${periodDialog.row.driver.name}`);
      setPeriodDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save start date');
    } finally {
      setPosting(null);
    }
  }

  function openLeaveDialog(row: MonthlyPayrollRow) {
    setLeaveDialog({ row, leaveByDate: new Map(), deductNewLeaveFromSalary: false });
    loadLeaveDatesForDialog(row);
  }

  async function loadLeaveDatesForDialog(row: MonthlyPayrollRow) {
    const { data } = await supabase
      .from('driver_leave')
      .select('date, deduct_salary')
      .eq('driver_name', row.driver.name)
      .gte('date', row.periodStart)
      .lte('date', row.periodEnd);
    const leaveByDate = new Map<string, boolean>();
    for (const r of data || []) {
      leaveByDate.set(r.date, !!r.deduct_salary);
    }
    const deductNewLeaveFromSalary =
      leaveByDate.size > 0 && [...leaveByDate.values()].every(Boolean);
    setLeaveDialog({
      row,
      leaveByDate,
      deductNewLeaveFromSalary,
    });
  }

  function toggleLeaveDate(date: string) {
    setLeaveDialog((prev) => {
      if (!prev) return prev;
      const next = new Map(prev.leaveByDate);
      if (!next.has(date)) {
        next.set(date, prev.deductNewLeaveFromSalary);
      } else if (!next.get(date)) {
        next.set(date, true);
      } else {
        next.delete(date);
      }
      return { ...prev, leaveByDate: next };
    });
  }

  function setDeductNewLeaveFromSalary(checked: boolean) {
    setLeaveDialog((prev) => {
      if (!prev) return prev;
      const next = new Map(prev.leaveByDate);
      for (const date of next.keys()) next.set(date, checked);
      return { ...prev, leaveByDate: next, deductNewLeaveFromSalary: checked };
    });
  }

  async function handleSaveLeave() {
    if (!leaveDialog) return;
    setPosting('leave');
    try {
      const leaveEntries: DriverLeaveEntry[] = [...leaveDialog.leaveByDate.entries()].map(
        ([date, deduct_salary]) => ({ date, deduct_salary }),
      );
      await setDriverLeaveDates(
        leaveDialog.row.driver,
        selectedMonth,
        leaveEntries,
        {
          driver_name: leaveDialog.row.driver.name,
          month: selectedMonth,
          start_date: leaveDialog.row.periodStart,
          end_date: leaveDialog.row.periodEnd,
        },
      );
      toast.success(`Leave updated for ${leaveDialog.row.driver.name}`);
      setLeaveDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save leave');
    } finally {
      setPosting(null);
    }
  }

  async function handlePostAdvance() {
    if (!advanceDialog) return;
    const amount = Number(advanceDialog.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid advance amount');
      return;
    }
    setPosting('advance');
    try {
      const driver =
        rows.find((r) => r.driver.name === advanceDialog.driverName)?.driver
        ?? inactiveRows.find((r) => r.driver.name === advanceDialog.driverName)?.driver
        ?? inactiveDrivers.find((d) => d.name === advanceDialog.driverName);
      if (!driver) throw new Error('Driver not found');
      await postAdvance(driver, advanceDialog.date, amount, advanceDialog.description);
      toast.success(`Advance posted for ${advanceDialog.driverName}`);
      setAdvanceDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post advance');
    } finally {
      setPosting(null);
    }
  }

  function openAdvance(driverName: string) {
    setAdvanceDialog({
      driverName,
      date: today,
      amount: '',
      description: '',
    });
  }

  const monthLabel = getMonthFilterOptions().find((o) => o.value === selectedMonth)?.label
    ?? selectedMonth;

  const activeDisplayRows = useMemo(() => {
    return rows
      .filter((r) => r.driver.status === 'active')
      .map((row) => {
        const salaryOverride = Number(salaryInputs[row.driver.name]);
        const { gross, balance } = computePayrollTotals(
          row,
          Number.isFinite(salaryOverride) && salaryOverride > 0 ? salaryOverride : undefined,
        );
        return { ...row, gross, balance };
      });
  }, [rows, salaryInputs]);

  const inactiveDisplayRows = useMemo(() => {
    return inactiveRows.map((row) => {
      const salaryOverride = Number(salaryInputs[row.driver.name]);
      const { gross, balance } = computePayrollTotals(
        row,
        Number.isFinite(salaryOverride) && salaryOverride > 0 ? salaryOverride : undefined,
      );
      return { ...row, gross, balance };
    });
  }, [inactiveRows, salaryInputs]);

  const summary = useMemo(() => {
    const list = tab === 'active' ? activeDisplayRows : inactiveDisplayRows;
    const needsPay = list.filter((r) => {
      const s = getPayStatus(r);
      return s.label === 'Needs pay';
    });
    return {
      driverCount: list.length,
      needsPayCount: needsPay.length,
      allowanceLeft: list.reduce((s, r) => s + Math.max(0, r.allowanceShortfall), 0),
      salaryLeft: list.reduce((s, r) => s + (r.salaryPaid > 0 ? 0 : Math.max(0, r.salaryDue)), 0),
      balanceLeft: list.reduce((s, r) => s + Math.max(0, r.balance), 0),
    };
  }, [tab, activeDisplayRows, inactiveDisplayRows]);

  function suggestedMonthLabel(month: string): string {
    return getMonthFilterOptions().find((o) => o.value === month)?.label ?? month;
  }

  function renderDriverCard(row: DisplayRow, opts?: { showLeftDate?: boolean }) {
    const status = getPayStatus(row);
    const expanded = expandedDriver === row.driver.name;
    const needsAllowance = row.allowanceShortfall > 0.01 && row.workingDays > 0;
    const needsSalary = row.salaryPaid <= 0;
    const salaryLeft = row.salaryPaid > 0 ? 0 : Math.max(0, Number(salaryInputs[row.driver.name]) || row.salaryDue);
    const exitPay = computeIfLeavesTodayPay(row, selectedMonth);
    const isCurrentMonth = selectedMonth === today.slice(0, 7);

    return (
      <Card key={row.driver.name}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{row.driver.name}</p>
              {opts?.showLeftDate && row.driver.left_date && (
                <p className="text-xs text-gray-500 mt-0.5">Left {formatDate(row.driver.left_date)}</p>
              )}
            </div>
            <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-xs font-medium', status.className)}>
              {status.label}
            </span>
          </div>

          <div
            className={cn(
              'rounded-lg border px-3 py-2.5',
              exitPay.overpaid > 0
                ? 'border-green-300 bg-green-50'
                : exitPay.total > 0
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-gray-50',
            )}
          >
            <p className="text-[10px] uppercase tracking-wide text-gray-600">
              {isCurrentMonth ? 'If leaves today, pay' : 'To clear this month'}
            </p>
            <p className={cn(
              'text-xl font-bold',
              exitPay.overpaid > 0 ? 'text-green-700' : exitPay.total > 0 ? 'text-blue-800' : 'text-green-700',
            )}>
              {exitPay.overpaid > 0
                ? `Overpaid ${formatCurrency(exitPay.overpaid)}`
                : formatCurrency(exitPay.total)}
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
              Allowance {formatCurrency(exitPay.allowanceLeft)}
              {' + '}
              Salary {formatCurrency(exitPay.salaryLeft)}
              {exitPay.advances > 0 && (
                <> − Advances {formatCurrency(exitPay.advances)}</>
              )}
              {isCurrentMonth && (
                <span className="text-gray-400"> · as of {formatDate(exitPay.asOf)}</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-gray-50 border px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Allowance left</p>
              <p className={cn('font-semibold', row.allowanceShortfall > 0 ? 'text-amber-700' : 'text-green-700')}>
                {row.allowanceShortfall > 0
                  ? `${formatCurrency(row.allowanceShortfall)}${row.daysShortfall > 0 ? ` (~${row.daysShortfall}d)` : ''}`
                  : 'Paid'}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 border px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500">Full-month salary</p>
              <p className={cn('font-semibold', needsSalary ? 'text-amber-700' : 'text-green-700')}>
                {needsSalary ? formatCurrency(salaryLeft) : (
                  <span className="inline-flex items-center gap-1">
                    Paid <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {needsAllowance && (
              <Button
                size="sm"
                className="flex-1 min-w-[120px]"
                disabled={posting === `allowance-${row.driver.name}`}
                onClick={() => openAllowanceDialog(row)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Pay allowance
              </Button>
            )}
            {needsSalary && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-w-[120px]"
                disabled={posting === `salary-${row.driver.name}`}
                onClick={() => handlePostSalary(row)}
              >
                Post salary
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 min-w-[90px]"
              onClick={() => setExpandedDriver(expanded ? null : row.driver.name)}
            >
              More
              {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>

          {expanded && (
            <div className="border-t pt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-gray-500">Working</p>
                  <p className="font-medium">{row.workingDays}d</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500">Leave</p>
                  <p className="font-medium">
                    {row.leaveDays}
                    {row.salaryLeaveDays > 0 && (
                      <span className="text-[10px] text-red-500 ml-1">({row.salaryLeaveDays}↓sal)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500">Advances</p>
                  <p className="font-medium text-red-600">{formatCurrency(row.advancePaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500">Balance</p>
                  <p className={cn(
                    'font-medium',
                    row.balance > 0 ? 'text-amber-700' : row.balance < 0 ? 'text-red-600' : 'text-green-700',
                  )}>
                    {formatCurrency(row.balance)}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-[10px] uppercase text-gray-500 mb-1">Period</p>
                <button
                  type="button"
                  className="text-blue-700 hover:underline font-medium"
                  onClick={() => openPeriodDialog(row)}
                >
                  {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
                </button>
              </div>

              {needsSalary && (
                <div>
                  <Label className="text-xs text-gray-500">Salary amount</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={salaryInputs[row.driver.name] ?? ''}
                    onChange={(e) =>
                      setSalaryInputs((prev) => ({ ...prev, [row.driver.name]: e.target.value }))
                    }
                  />
                  {row.salaryDue < row.salaryDefault && (
                    <p className="text-[10px] text-gray-500 mt-0.5">Default was {formatCurrency(row.salaryDefault)}</p>
                  )}
                </div>
              )}

              {opts?.showLeftDate && row.driver.settlement_notes && (
                <p className="text-xs text-gray-600">{row.driver.settlement_notes}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openLeaveDialog(row)}>
                  Mark leave
                </Button>
                <Button size="sm" variant="outline" onClick={() => openPeriodDialog(row)}>
                  Set period
                </Button>
                <Button size="sm" variant="outline" onClick={() => openAdvance(row.driver.name)}>
                  Salary advance
                </Button>
                {row.allowancePaid > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200"
                    disabled={posting === `revert-allowance-${row.driver.name}`}
                    onClick={() => handleRevertLastAllowance(row)}
                  >
                    Revert allowance
                  </Button>
                )}
                {row.salaryPaid > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200"
                    disabled={posting === `revert-salary-${row.driver.name}`}
                    onClick={() => handleRevertSalary(row)}
                  >
                    Revert salary
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Payroll" />

      <p className="text-sm text-gray-500 -mt-4">
        Daily allowance <strong>₹500/day</strong> · Salary once a month · Advances reduce what you still owe.
        {' '}Blue box = <strong>if they leave today</strong> (salary prorated to today).
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="sm:w-56">
          <Label className="text-xs text-gray-500 mb-1 block">Month</Label>
          <select
            className={FILTER_SELECT_CLASS}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {getMonthFilterOptions()
              .filter((o) => o.value)
              .map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {([
          ['active', 'Active drivers'],
          ['inactive', 'Inactive'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setExpandedDriver(null); setShowSummary(false); }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{monthLabel}</p>
            <p className="text-sm font-semibold text-gray-900">
              {summary.needsPayCount} need pay
              <span className="font-normal text-gray-400"> · </span>
              <span className="font-normal text-gray-600">{summary.driverCount} drivers</span>
            </p>
          </div>
          {showSummary
            ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />}
        </button>
        {showSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-gray-500">Allowance left</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.allowanceLeft)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-gray-500">Salary left</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.salaryLeft)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-gray-500">Balance left</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.balanceLeft)}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {tab === 'active' && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">Loading…</CardContent>
            </Card>
          ) : activeDisplayRows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No active drivers for {monthLabel}
              </CardContent>
            </Card>
          ) : (
            activeDisplayRows.map((row) => renderDriverCard(row))
          )}
        </div>
      )}

      {tab === 'inactive' && (
        <div className="space-y-4">
          {inactiveDrivers.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Former drivers</p>
                  <p className="text-xs text-gray-500">Jump to their last month to settle full &amp; final.</p>
                </div>
                <div className="space-y-2">
                  {inactiveDrivers.map((driver) => {
                    const suggested = getSuggestedPayrollMonth(driver);
                    return (
                      <div key={driver.name} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{driver.name}</p>
                          <p className="text-xs text-gray-500">
                            {driver.left_date ? `Left ${formatDate(driver.left_date)}` : 'No left date'}
                          </p>
                        </div>
                        {suggested && suggested !== selectedMonth && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedMonth(suggested)}>
                            View {suggestedMonthLabel(suggested)}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">Loading…</CardContent>
              </Card>
            ) : inactiveDrivers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">No inactive drivers</CardContent>
              </Card>
            ) : inactiveDisplayRows.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No payroll for {monthLabel}. Use &quot;View …&quot; above to open their last month.
                </CardContent>
              </Card>
            ) : (
              inactiveDisplayRows.map((row) => renderDriverCard(row, { showLeftDate: true }))
            )}
          </div>
        </div>
      )}

      <Dialog open={!!leaveDialog} onOpenChange={(o) => !o && setLeaveDialog(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Mark leave — {leaveDialog?.row.driver.name}</DialogTitle>
          </DialogHeader>
          {leaveDialog && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Click a date: leave (no allowance) → leave + salary deduct → working. Or use the checkbox to apply salary deduction to all leave days.
              </p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={leaveDialog.deductNewLeaveFromSalary}
                  onChange={(e) => setDeductNewLeaveFromSalary(e.target.checked)}
                />
                Deduct from salary for marked leave days
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                {getEmploymentDaysInMonth(leaveDialog.row.driver, selectedMonth, {
                  driver_name: leaveDialog.row.driver.name,
                  month: selectedMonth,
                  start_date: leaveDialog.row.periodStart,
                  end_date: leaveDialog.row.periodEnd,
                }, null).map((date) => {
                  const isLeave = leaveDialog.leaveByDate.has(date);
                  const deductSalary = leaveDialog.leaveByDate.get(date) ?? false;
                  const dayNum = new Date(date + 'T12:00:00').getDate();
                  const dow = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
                  const spansMonths = leaveDialog.row.periodStart.slice(0, 7) !== leaveDialog.row.periodEnd.slice(0, 7);
                  const monthShort = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { month: 'short' });
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleLeaveDate(date)}
                      className={cn(
                        'rounded-md border px-1 py-1.5 text-center text-xs transition-colors',
                        spansMonths ? 'w-16' : 'w-14',
                        isLeave && deductSalary
                          ? 'border-red-600 bg-red-200 text-red-900'
                          : isLeave
                            ? 'border-red-300 bg-red-100 text-red-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50',
                      )}
                    >
                      <div className="font-medium">{spansMonths ? `${dayNum} ${monthShort}` : dayNum}</div>
                      <div className="text-[10px] opacity-70">{dow}</div>
                      {isLeave && deductSalary && (
                        <div className="text-[9px] font-semibold text-red-700">−sal</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-gray-600">
                {leaveDialog.leaveByDate.size} leave day(s)
                {[...leaveDialog.leaveByDate.values()].filter(Boolean).length > 0 && (
                  <> · {[...leaveDialog.leaveByDate.values()].filter(Boolean).length} deduct salary</>
                )}
                {' · '}
                {getEmploymentDaysInMonth(leaveDialog.row.driver, selectedMonth, {
                  driver_name: leaveDialog.row.driver.name,
                  month: selectedMonth,
                  start_date: leaveDialog.row.periodStart,
                  end_date: leaveDialog.row.periodEnd,
                }, null).length - leaveDialog.leaveByDate.size} working day(s) in period
              </p>
              <Button className="w-full" disabled={posting === 'leave'} onClick={handleSaveLeave}>
                Save leave
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!periodDialog} onOpenChange={(o) => !o && setPeriodDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Payroll period — {periodDialog?.row.driver.name}</DialogTitle>
          </DialogHeader>
          {periodDialog && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                First and last working day for this cycle. Can start in the previous month or end in the next (e.g. 18 Jul–18 Aug). Allowance counts only between these dates.
              </p>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={periodDialog.startDate}
                  min={periodPickerBounds(selectedMonth).min}
                  max={periodDialog.endDate}
                  onChange={(e) => setPeriodDialog({ ...periodDialog, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={periodDialog.endDate}
                  min={periodDialog.startDate}
                  max={periodPickerBounds(selectedMonth).max}
                  onChange={(e) => setPeriodDialog({ ...periodDialog, endDate: e.target.value })}
                />
              </div>
              <Button className="w-full" disabled={posting === 'period'} onClick={handleSavePeriod}>
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!allowanceDialog} onOpenChange={(o) => !o && setAllowanceDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Pay allowance — {allowanceDialog?.row.driver.name}</DialogTitle>
          </DialogHeader>
          {allowanceDialog && (
            <div className="space-y-4">
              <div>
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={allowanceDialog.date}
                  onChange={(e) => setAllowanceDialog({ ...allowanceDialog, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={allowanceDialog.days}
                    onChange={(e) => updateAllowanceDays(e.target.value, allowanceDialog.row.dailyRate)}
                  />
                </div>
                <div>
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={allowanceDialog.amount}
                    onChange={(e) => setAllowanceDialog({ ...allowanceDialog, amount: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                ₹{allowanceDialog.row.dailyRate}/day · e.g. 2 days = ₹{allowanceDialog.row.dailyRate * 2}
              </p>
              <Button
                className="w-full"
                disabled={posting === `allowance-${allowanceDialog.row.driver.name}`}
                onClick={handlePostAllowance}
              >
                Post allowance
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!advanceDialog} onOpenChange={(o) => !o && setAdvanceDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>Give salary advance — {advanceDialog?.driverName}</DialogTitle>
          </DialogHeader>
          {advanceDialog && (
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={advanceDialog.date}
                  onChange={(e) => setAdvanceDialog({ ...advanceDialog, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min={1}
                  value={advanceDialog.amount}
                  onChange={(e) => setAdvanceDialog({ ...advanceDialog, amount: e.target.value })}
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={advanceDialog.description}
                  onChange={(e) => setAdvanceDialog({ ...advanceDialog, description: e.target.value })}
                  placeholder="Advance payment"
                />
              </div>
              <Button className="w-full" disabled={posting === 'advance'} onClick={handlePostAdvance}>
                Post advance
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
