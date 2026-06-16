'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  computePayrollTotals,
  fetchInactiveDrivers,
  fetchInactivePayroll,
  fetchMonthlyPayroll,
  getEmploymentDaysInMonth,
  getMonthBounds,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type Tab = 'allowance' | 'monthly' | 'inactive';

function renderLeaveDaysCell(row: MonthlyPayrollRow) {
  if (row.leaveDays <= 0) return '0';
  return (
    <span
      className="text-red-600"
      title={row.salaryLeaveDays > 0 ? `${row.salaryLeaveDays} day(s) deduct salary` : undefined}
    >
      {row.leaveDays}
      {row.salaryLeaveDays > 0 && (
        <span className="text-[10px] block text-red-500">{row.salaryLeaveDays}↓sal</span>
      )}
    </span>
  );
}

export default function PayrollPage() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const [tab, setTab] = useState<Tab>('allowance');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonthlyPayrollRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<MonthlyPayrollRow[]>([]);
  const [inactiveDrivers, setInactiveDrivers] = useState<Driver[]>([]);
  const [salaryInputs, setSalaryInputs] = useState<Record<string, string>>({});
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
      await revertSalary(row.driver.name, selectedMonth);
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
      await revertLastAllowance(row.driver.name, selectedMonth);
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
      toast.success(`Start date saved for ${periodDialog.row.driver.name}`);
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
    const { from, to } = getMonthBounds(selectedMonth);
    const { data } = await supabase
      .from('driver_leave')
      .select('date, deduct_salary')
      .eq('driver_name', row.driver.name)
      .gte('date', from)
      .lte('date', to);
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'allowance', label: 'Daily allowance' },
    { id: 'monthly', label: 'Monthly summary' },
    { id: 'inactive', label: 'Inactive drivers' },
  ];

  const allowanceRows = rows.filter((r) => r.driver.status === 'active');

  const monthlyDisplayRows = useMemo(
    () =>
      rows.map((row) => {
        const salaryOverride = Number(salaryInputs[row.driver.name]);
        const { gross, balance } = computePayrollTotals(
          row,
          Number.isFinite(salaryOverride) && salaryOverride > 0 ? salaryOverride : undefined,
        );
        return { ...row, gross, balance };
      }),
    [rows, salaryInputs],
  );

  const inactiveDisplayRows = useMemo(
    () =>
      inactiveRows.map((row) => {
        const salaryOverride = Number(salaryInputs[row.driver.name]);
        const { gross, balance } = computePayrollTotals(
          row,
          Number.isFinite(salaryOverride) && salaryOverride > 0 ? salaryOverride : undefined,
        );
        return { ...row, gross, balance };
      }),
    [inactiveRows, salaryInputs],
  );

  function suggestedMonthLabel(month: string): string {
    return getMonthFilterOptions().find((o) => o.value === month)?.label ?? month;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Driver Payroll" />

      <Card className="border-dashed">
        <CardContent className="pt-6">
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
            <p className="text-sm text-gray-500 pb-2">
              {tab === 'inactive' ? (
                <>Pick the month they worked — usually their last month before leaving.</>
              ) : (
                <>Allowance = <strong>₹500 per working day</strong> (through today for this month). Set start date per driver, then mark leave.</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'allowance' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily allowance — {monthLabel}</CardTitle>
            <p className="text-xs text-gray-500">
              Working days = days from start date through today (current month) minus leave. Pay allowance in lumps as you go.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Working</TableHead>
                  <TableHead className="text-right">Leave</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Shortfall</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">Loading…</TableCell>
                  </TableRow>
                ) : allowanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No drivers for {monthLabel}
                    </TableCell>
                  </TableRow>
                ) : (
                  allowanceRows.map((row) => (
                    <TableRow key={row.driver.name}>
                      <TableCell>
                        <div className="font-medium">{row.driver.name}</div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-sm text-blue-700 hover:underline"
                          onClick={() => openPeriodDialog(row)}
                        >
                          {formatDate(row.periodStart)}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">{row.workingDays}</TableCell>
                      <TableCell className="text-right">{renderLeaveDaysCell(row)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.allowanceDue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.allowancePaid)}</TableCell>
                      <TableCell className={cn(
                        'text-right font-medium',
                        row.allowanceShortfall > 0 ? 'text-amber-700' : 'text-green-700',
                      )}>
                        {row.allowanceShortfall > 0
                          ? `${formatCurrency(row.allowanceShortfall)} (~${row.daysShortfall}d)`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {row.driver.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openLeaveDialog(row)}
                            >
                              Mark leave
                            </Button>
                          )}
                          {row.driver.status === 'active' && row.workingDays > 0 && row.allowanceShortfall > 0 && (
                            <Button
                              size="sm"
                              disabled={posting === `allowance-${row.driver.name}`}
                              onClick={() => openAllowanceDialog(row)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Pay allowance
                            </Button>
                          )}
                          {row.allowancePaid > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              disabled={posting === `revert-allowance-${row.driver.name}`}
                              onClick={() => handleRevertLastAllowance(row)}
                            >
                              Revert last
                            </Button>
                          )}
                          {row.driver.status === 'active' && (
                            <Button size="sm" variant="ghost" onClick={() => openAdvance(row.driver.name)}>
                              Advance
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'monthly' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly summary — {monthLabel}</CardTitle>
            <p className="text-xs text-gray-500">
              Total due = salary (reduced if leave deducts salary) + allowance due. Balance = total due − allowance paid − advances − salary paid.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Working</TableHead>
                  <TableHead className="text-right">Leave</TableHead>
                  <TableHead className="text-right">Allowance due</TableHead>
                  <TableHead className="text-right">Allowance paid</TableHead>
                  <TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Total due</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">Loading…</TableCell>
                  </TableRow>
                ) : monthlyDisplayRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">No drivers for this month</TableCell>
                  </TableRow>
                ) : (
                  monthlyDisplayRows.map((row) => (
                    <TableRow key={row.driver.name}>
                      <TableCell>
                        <div className="font-medium">{row.driver.name}</div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-sm text-blue-700 hover:underline"
                          onClick={() => openPeriodDialog(row)}
                        >
                          {formatDate(row.periodStart)}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">{row.workingDays}</TableCell>
                      <TableCell className="text-right">{renderLeaveDaysCell(row)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.allowanceDue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.allowancePaid)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.advancePaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.gross)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            value={salaryInputs[row.driver.name] ?? ''}
                            onChange={(e) =>
                              setSalaryInputs((prev) => ({ ...prev, [row.driver.name]: e.target.value }))
                            }
                            disabled={row.salaryPaid > 0}
                          />
                          {row.salaryPaid > 0 && (
                            <Check className="h-4 w-4 text-green-600 shrink-0" />
                          )}
                        </div>
                        {row.salaryDue < row.salaryDefault && row.salaryPaid === 0 && (
                          <p className="text-[10px] text-gray-500 mt-0.5">was {formatCurrency(row.salaryDefault)}</p>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-medium',
                        row.balance > 0 ? 'text-amber-700' : row.balance < 0 ? 'text-red-600' : 'text-green-700',
                      )}>
                        {formatCurrency(row.balance)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {row.salaryPaid === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={posting === `salary-${row.driver.name}`}
                              onClick={() => handlePostSalary(row)}
                            >
                              Post salary
                            </Button>
                          )}
                          {row.salaryPaid > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              disabled={posting === `revert-salary-${row.driver.name}`}
                              onClick={() => handleRevertSalary(row)}
                            >
                              Revert salary
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openAdvance(row.driver.name)}>
                            Advance
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'inactive' && (
        <>
          {inactiveDrivers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Former drivers ({inactiveDrivers.length})</CardTitle>
                <p className="text-xs text-gray-500">
                  Jump to the month they left to view or settle full &amp; final payments.
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Left</TableHead>
                      <TableHead>Settlement notes</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveDrivers.map((driver) => {
                      const suggested = getSuggestedPayrollMonth(driver);
                      return (
                        <TableRow key={driver.name}>
                          <TableCell className="font-medium">{driver.name}</TableCell>
                          <TableCell>{driver.left_date ? formatDate(driver.left_date) : '—'}</TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                            {driver.settlement_notes || '—'}
                          </TableCell>
                          <TableCell>
                            {suggested && suggested !== selectedMonth && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMonth(suggested)}
                              >
                                View {suggestedMonthLabel(suggested)}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payroll — {monthLabel}</CardTitle>
              <p className="text-xs text-gray-500">
                Full &amp; final settlement for inactive drivers. Post salary or advance here; balance should reach ₹0 when settled.
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="text-right">Working</TableHead>
                    <TableHead className="text-right">Leave</TableHead>
                    <TableHead className="text-right">Allowance due</TableHead>
                    <TableHead className="text-right">Allowance paid</TableHead>
                    <TableHead className="text-right">Advances</TableHead>
                    <TableHead className="text-right">Total due</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">Loading…</TableCell>
                    </TableRow>
                  ) : inactiveDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        No inactive drivers
                      </TableCell>
                    </TableRow>
                  ) : inactiveDisplayRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        No payroll for {monthLabel}. Use &quot;View …&quot; above to open their last month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inactiveDisplayRows.map((row) => (
                      <TableRow key={row.driver.name}>
                        <TableCell>
                          <div className="font-medium">{row.driver.name}</div>
                          {row.driver.left_date && (
                            <span className="text-xs text-gray-500">Left {formatDate(row.driver.left_date)}</span>
                          )}
                          {row.driver.settlement_notes && (
                            <p className="text-xs text-gray-500 mt-0.5">{row.driver.settlement_notes}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-sm text-blue-700 hover:underline"
                            onClick={() => openPeriodDialog(row)}
                          >
                            {formatDate(row.periodStart)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">{row.workingDays}</TableCell>
                        <TableCell className="text-right">{renderLeaveDaysCell(row)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.allowanceDue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.allowancePaid)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.advancePaid)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.gross)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <Input
                              type="number"
                              className="h-8 text-sm"
                              value={salaryInputs[row.driver.name] ?? ''}
                              onChange={(e) =>
                                setSalaryInputs((prev) => ({ ...prev, [row.driver.name]: e.target.value }))
                              }
                              disabled={row.salaryPaid > 0}
                            />
                            {row.salaryPaid > 0 && (
                              <Check className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-medium',
                          row.balance > 0 ? 'text-amber-700' : row.balance < 0 ? 'text-red-600' : 'text-green-700',
                        )}>
                          {formatCurrency(row.balance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {row.salaryPaid === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={posting === `salary-${row.driver.name}`}
                                onClick={() => handlePostSalary(row)}
                              >
                                Post salary
                              </Button>
                            )}
                            {row.salaryPaid > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                disabled={posting === `revert-salary-${row.driver.name}`}
                                onClick={() => handleRevertSalary(row)}
                              >
                                Revert salary
                              </Button>
                            )}
                            {row.allowancePaid > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                disabled={posting === `revert-allowance-${row.driver.name}`}
                                onClick={() => handleRevertLastAllowance(row)}
                              >
                                Revert allowance
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openAdvance(row.driver.name)}>
                              Advance
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!leaveDialog} onOpenChange={(o) => !o && setLeaveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark leave — {leaveDialog?.row.driver.name}</DialogTitle>
          </DialogHeader>
          {leaveDialog && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Click a date: leave (no allowance) → leave + salary deduct → working. Or use the checkbox to apply salary deduction to all leave days. {monthLabel}
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
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleLeaveDate(date)}
                      className={cn(
                        'w-14 rounded-md border px-1 py-1.5 text-center text-xs transition-colors',
                        isLeave && deductSalary
                          ? 'border-red-600 bg-red-200 text-red-900'
                          : isLeave
                            ? 'border-red-300 bg-red-100 text-red-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50',
                      )}
                    >
                      <div className="font-medium">{dayNum}</div>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Month start — {periodDialog?.row.driver.name}</DialogTitle>
          </DialogHeader>
          {periodDialog && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                First and last working day in {monthLabel}. Allowance counts only between these dates.
              </p>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={periodDialog.startDate}
                  min={getMonthBounds(selectedMonth).from}
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
                  max={getMonthBounds(selectedMonth).to}
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
        <DialogContent className="max-w-sm">
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Give advance — {advanceDialog?.driverName}</DialogTitle>
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
