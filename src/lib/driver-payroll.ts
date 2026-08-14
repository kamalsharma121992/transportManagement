import { supabase, type Driver, type Expense, DRIVER_PAY_CATEGORIES, SALARY_CATEGORIES } from '@/lib/supabase';
import { getMonthDateRange } from '@/lib/format';

export type DriverLeaveEntry = {
  date: string;
  deduct_salary: boolean;
};

export type DriverLeaveByDriver = {
  leaveDates: Set<string>;
  salaryDeductDates: Set<string>;
};

export type PayrollPayLine = {
  id: number;
  date: string;
  kind: 'advance' | 'allowance' | 'salary';
  amount: number;
  note: string;
  description: string | null;
};

export type MonthlyPayrollRow = {
  driver: Driver;
  workingDays: number;
  leaveDays: number;
  salaryLeaveDays: number;
  periodStart: string;
  periodEnd: string;
  allowancePaid: number;
  allowanceDue: number;
  allowanceShortfall: number;
  daysShortfall: number;
  advancePaid: number;
  salaryPaid: number;
  salaryDefault: number;
  salaryDue: number;
  dailyRate: number;
  gross: number;
  balance: number;
  payLines: PayrollPayLine[];
};

export type DriverPayrollPeriod = {
  driver_name: string;
  month: string;
  start_date: string;
  end_date: string | null;
};

/** Salary after optional leave deductions: monthly ÷ period days × unpaid leave days. */
export function computeSalaryDue(
  monthlySalary: number,
  periodDays: number,
  salaryDeductLeaveDays: number,
): number {
  if (salaryDeductLeaveDays <= 0 || periodDays <= 0) return monthlySalary;
  const dailyRate = monthlySalary / periodDays;
  return Math.max(0, Math.round(monthlySalary - salaryDeductLeaveDays * dailyRate));
}

/** Total payable for the month; optional salary override when not yet posted. */
export function computePayrollTotals(
  row: Pick<
    MonthlyPayrollRow,
    | 'salaryDefault'
    | 'salaryDue'
    | 'salaryPaid'
    | 'allowanceDue'
    | 'allowancePaid'
    | 'advancePaid'
  >,
  salaryOverride?: number,
): { salaryForMonth: number; gross: number; balance: number } {
  const baseSalary = row.salaryDue;
  const salaryForMonth =
    row.salaryPaid > 0
      ? row.salaryPaid
      : (salaryOverride != null && salaryOverride > 0 ? salaryOverride : baseSalary);
  const gross = salaryForMonth + row.allowanceDue;
  const balance = gross - row.allowancePaid - row.advancePaid - row.salaryPaid;
  return { salaryForMonth, gross, balance };
}

function inclusiveDayCount(from: string, to: string): number {
  if (from > to) return 0;
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

/**
 * Full & final as of today (current month) or period end (past months).
 * ₹ monthly salary belongs to the selected period (start→end), not the calendar month.
 */
export function computeIfLeavesTodayPay(
  row: Pick<
    MonthlyPayrollRow,
    | 'periodStart'
    | 'periodEnd'
    | 'salaryDefault'
    | 'salaryPaid'
    | 'salaryLeaveDays'
    | 'allowanceDue'
    | 'allowancePaid'
    | 'advancePaid'
  >,
  month: string,
): {
  total: number;
  allowanceLeft: number;
  salaryLeft: number;
  advances: number;
  salaryForExit: number;
  asOf: string;
  overpaid: number;
  periodDays: number;
  employedDays: number;
} {
  const asOf = getPayrollAsOfDate(month);
  const start = row.periodStart;
  const periodEnd = row.periodEnd;
  const end = asOf < periodEnd ? asOf : periodEnd;
  const periodDays = inclusiveDayCount(start, periodEnd);
  const employedDays = inclusiveDayCount(start, end);

  const dailySalary = periodDays > 0 ? row.salaryDefault / periodDays : 0;
  let salaryForExit = Math.round(dailySalary * employedDays);
  if (row.salaryLeaveDays > 0) {
    salaryForExit = Math.max(0, salaryForExit - Math.round(dailySalary * row.salaryLeaveDays));
  }

  const allowanceLeft = Math.max(0, row.allowanceDue - row.allowancePaid);
  const salaryLeft = Math.max(0, salaryForExit - row.salaryPaid);
  const advances = row.advancePaid;
  const raw = allowanceLeft + salaryLeft - advances;

  return {
    total: Math.max(0, raw),
    allowanceLeft,
    salaryLeft,
    advances,
    salaryForExit,
    asOf,
    overpaid: raw < 0 ? Math.abs(raw) : 0,
    periodDays,
    employedDays,
  };
}

export function getMonthBounds(month: string): { from: string; to: string } {
  return getMonthDateRange(month);
}

/** Widen a month window so custom payroll periods that spill into the previous/next month are included. */
export function payrollQueryRange(
  month: string,
  periods?: Map<string, DriverPayrollPeriod> | null,
): { from: string; to: string } {
  const bounds = getMonthBounds(month);
  if (!periods || periods.size === 0) return bounds;
  let from = bounds.from;
  let to = bounds.to;
  for (const p of periods.values()) {
    if (p.start_date && p.start_date < from) from = p.start_date;
    if (p.end_date && p.end_date > to) to = p.end_date;
  }
  return { from, to };
}

/** Date picker window: previous month through next month, so 18th–18th cycles can be selected. */
export function periodPickerBounds(month: string): { min: string; max: string } {
  const [year, mon] = month.split('-').map(Number);
  const prev = new Date(year, mon - 2, 1);
  const next = new Date(year, mon, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  return {
    min: getMonthBounds(prevMonth).from,
    max: getMonthBounds(nextMonth).to,
  };
}

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** For the current month, count only up to today; for past months, use full month. */
export function getPayrollAsOfDate(month: string): string {
  const { to } = getMonthBounds(month);
  const today = getTodayDateString();
  if (month === today.slice(0, 7) && today <= to) return today;
  return to;
}

/** Calendar days in the payroll period. Pass asOfDate to cap at today (current month allowance).
 *  A saved period may start in the previous month or end in the next (e.g. 18 Jul–18 Aug). */
export function getEmploymentDaysInMonth(
  driver: Driver,
  month: string,
  period?: DriverPayrollPeriod | null,
  asOfDate?: string | null,
): string[] {
  const { from, to } = getMonthBounds(month);
  let start = from;
  let end = to;

  if (period?.start_date || period?.end_date) {
    if (period.start_date) start = period.start_date;
    if (period.end_date) end = period.end_date;
  } else {
    if (driver.joined_date && driver.joined_date > start) start = driver.joined_date;
    if (driver.left_date && driver.left_date < end) end = driver.left_date;
  }

  if (asOfDate && asOfDate < end) end = asOfDate;

  if (start > end) return [];

  const days: string[] = [];
  const cursor = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');
  while (cursor <= endDate) {
    days.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getDefaultPeriodStart(driver: Driver, month: string): string {
  const { from } = getMonthBounds(month);
  if (driver.joined_date && driver.joined_date > from) return driver.joined_date;
  return from;
}

export function getDefaultPeriodEnd(driver: Driver, month: string): string {
  const { to } = getMonthBounds(month);
  if (driver.left_date && driver.left_date < to) return driver.left_date;
  return to;
}

export function countWorkingDays(employmentDays: string[], leaveDates: Set<string>): number {
  return employmentDays.filter((d) => !leaveDates.has(d)).length;
}

export function isDriverActiveInMonth(
  driver: Driver,
  month: string,
  period?: DriverPayrollPeriod | null,
): boolean {
  return getEmploymentDaysInMonth(driver, month, period).length > 0;
}

export async function fetchPayrollPeriods(month: string): Promise<Map<string, DriverPayrollPeriod>> {
  const { data, error } = await supabase
    .from('driver_payroll_period')
    .select('driver_name, month, start_date, end_date')
    .eq('month', month);

  const map = new Map<string, DriverPayrollPeriod>();
  if (error) return map;

  for (const row of data || []) {
    map.set(row.driver_name, row as DriverPayrollPeriod);
  }
  return map;
}

export async function setPayrollPeriod(
  driverName: string,
  month: string,
  startDate: string,
  endDate: string | null,
): Promise<void> {
  const { error } = await supabase.from('driver_payroll_period').upsert(
    {
      driver_name: driverName,
      month,
      start_date: startDate,
      end_date: endDate,
    },
    { onConflict: 'driver_name,month' },
  );
  if (error) throw error;
}

export async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.from('drivers').select('*').order('name');
  if (error) throw error;
  return (data || []).map(normalizeDriver);
}

export async function fetchActiveDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'active')
    .order('name');
  if (error) {
    const all = await fetchDrivers();
    return all.filter((d) => d.status !== 'inactive');
  }
  return (data || []).map(normalizeDriver);
}

function normalizeDriver(d: Record<string, unknown>): Driver {
  return {
    id: d.id as number,
    name: d.name as string,
    phone: (d.phone as string | null) ?? null,
    status: (d.status as string) ?? 'active',
    joined_date: (d.joined_date as string | null) ?? null,
    left_date: (d.left_date as string | null) ?? null,
    monthly_salary: Number(d.monthly_salary ?? 25000),
    daily_allowance: Number(d.daily_allowance ?? 500),
    settlement_notes: (d.settlement_notes as string | null) ?? null,
  };
}

export async function fetchLeaveForMonth(
  month: string,
  periods?: Map<string, DriverPayrollPeriod> | null,
): Promise<Map<string, DriverLeaveByDriver>> {
  const { from, to } = payrollQueryRange(month, periods);
  const { data, error } = await supabase
    .from('driver_leave')
    .select('driver_name, date, deduct_salary')
    .gte('date', from)
    .lte('date', to);

  const map = new Map<string, DriverLeaveByDriver>();
  if (error) return map;

  for (const row of data || []) {
    if (!map.has(row.driver_name)) {
      map.set(row.driver_name, { leaveDates: new Set(), salaryDeductDates: new Set() });
    }
    const entry = map.get(row.driver_name)!;
    entry.leaveDates.add(row.date);
    if (row.deduct_salary) entry.salaryDeductDates.add(row.date);
  }
  return map;
}

export async function setDriverLeaveDates(
  driver: Driver,
  month: string,
  leaveEntries: DriverLeaveEntry[],
  period?: DriverPayrollPeriod | null,
): Promise<void> {
  const employmentDays = new Set(getEmploymentDaysInMonth(driver, month, period, null));
  const validLeave = leaveEntries.filter((e) => employmentDays.has(e.date));
  const dates = [...employmentDays].sort();
  const from = dates[0] ?? getMonthBounds(month).from;
  const to = dates[dates.length - 1] ?? getMonthBounds(month).to;

  const { error: delError } = await supabase
    .from('driver_leave')
    .delete()
    .eq('driver_name', driver.name)
    .gte('date', from)
    .lte('date', to);
  if (delError) throw delError;

  if (validLeave.length === 0) return;

  const { error: insError } = await supabase
    .from('driver_leave')
    .insert(
      validLeave.map((e) => ({
        driver_name: driver.name,
        date: e.date,
        deduct_salary: e.deduct_salary,
      })),
    );
  if (insError) throw insError;
}

function hasDriverPayInMonth(
  driverName: string,
  allowanceByDriver: Map<string, number>,
  advanceByDriver: Map<string, number>,
  salaryByDriver: Map<string, number>,
): boolean {
  return (
    (allowanceByDriver.get(driverName) || 0) > 0
    || (advanceByDriver.get(driverName) || 0) > 0
    || (salaryByDriver.get(driverName) || 0) > 0
  );
}

type PayExpenseRow = {
  id: number;
  person: string | null;
  category: string;
  amount: number;
  date: string;
  description: string | null;
};

function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1 + months, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysToDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

/** Same calendar day next month, clamped (31 Jan → 28 Feb). */
function addCalendarMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthIndex = month - 1 + months;
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/**
 * Default cycle when none is saved. After a salary posted in a previous month,
 * start the day after that salary. Join date still wins if the driver joined later.
 * Not written to the DB — Set period remains the way to confirm or change dates.
 */
export function suggestPayrollPeriod(
  driver: Driver,
  month: string,
  lastSalaryDate: string | null,
): { start: string; end: string } {
  const { from, to } = getMonthBounds(month);
  const rollFromSalary = lastSalaryDate != null && lastSalaryDate < from;
  let start = rollFromSalary ? addDaysToDate(lastSalaryDate, 1) : from;
  if (driver.joined_date && driver.joined_date > start) start = driver.joined_date;
  let end = rollFromSalary ? addCalendarMonthsClamped(start, 1) : to;
  if (driver.left_date && driver.left_date < end) end = driver.left_date;
  if (start > end) return { start: from, end: to };
  return { start, end };
}

function lastSalaryByDriverBefore(rows: PayExpenseRow[], beforeDate: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of rows) {
    if (!e.person || !isSalaryCategory(e.category) || e.date >= beforeDate) continue;
    const prev = map.get(e.person);
    if (!prev || e.date > prev) map.set(e.person, e.date);
  }
  return map;
}

function withSuggestedPeriods(
  drivers: Driver[],
  month: string,
  saved: Map<string, DriverPayrollPeriod>,
  lastSalary: Map<string, string>,
): Map<string, DriverPayrollPeriod> {
  const out = new Map(saved);
  for (const driver of drivers) {
    if (out.has(driver.name)) continue;
    const { start, end } = suggestPayrollPeriod(driver, month, lastSalary.get(driver.name) ?? null);
    out.set(driver.name, {
      driver_name: driver.name,
      month,
      start_date: start,
      end_date: end,
    });
  }
  return out;
}

function isSalaryCategory(category: string): boolean {
  return SALARY_CATEGORIES.includes(category as (typeof SALARY_CATEGORIES)[number]);
}

function driverCycleWindow(
  driver: Driver,
  month: string,
  period?: DriverPayrollPeriod | null,
): { start: string; end: string } {
  const days = getEmploymentDaysInMonth(driver, month, period);
  return {
    start: days[0] ?? getDefaultPeriodStart(driver, month),
    end: days[days.length - 1] ?? getDefaultPeriodEnd(driver, month),
  };
}

/** Allowance/salary in this cycle only. Advances after the last prior salary, through cycle end. */
function allocateDriverPay(
  driver: Driver,
  month: string,
  period: DriverPayrollPeriod | null | undefined,
  expenses: PayExpenseRow[],
): { allowance: number; advance: number; salary: number; lines: PayrollPayLine[] } {
  const { start, end } = driverCycleWindow(driver, month, period);
  const rows = expenses.filter((e) => e.person === driver.name);
  const lines: PayrollPayLine[] = [];
  let allowance = 0;
  let salary = 0;
  let priorSalaryDate: string | null = null;

  for (const e of rows) {
    const amt = Number(e.amount) || 0;
    if (isSalaryCategory(e.category)) {
      if (e.date >= start && e.date <= end) {
        salary += amt;
        lines.push({
          id: e.id,
          date: e.date,
          kind: 'salary',
          amount: amt,
          note: 'In this period',
          description: e.description,
        });
      }
      if (e.date < start && (!priorSalaryDate || e.date > priorSalaryDate)) priorSalaryDate = e.date;
    } else if (e.category === DRIVER_PAY_CATEGORIES.allowance) {
      if (e.date >= start && e.date <= end) {
        allowance += amt;
        lines.push({
          id: e.id,
          date: e.date,
          kind: 'allowance',
          amount: amt,
          note: 'In this period',
          description: e.description,
        });
      }
    }
  }

  let advance = 0;
  for (const e of rows) {
    if (e.category !== DRIVER_PAY_CATEGORIES.advance) continue;
    if (e.date > end) continue;
    if (priorSalaryDate && e.date <= priorSalaryDate) continue;
    const amt = Number(e.amount) || 0;
    advance += amt;
    lines.push({
      id: e.id,
      date: e.date,
      kind: 'advance',
      amount: amt,
      note: e.date < start ? 'Before start — held until salary' : 'In this period',
      description: e.description,
    });
  }

  lines.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  return { allowance, advance, salary, lines };
}

function buildPayrollRows(
  drivers: Driver[],
  month: string,
  periodByDriver: Map<string, DriverPayrollPeriod>,
  leaveByDriver: Map<string, DriverLeaveByDriver>,
  allowanceByDriver: Map<string, number>,
  advanceByDriver: Map<string, number>,
  salaryByDriver: Map<string, number>,
  payLinesByDriver: Map<string, PayrollPayLine[]>,
): MonthlyPayrollRow[] {
  return drivers.map((driver) => {
    const period = periodByDriver.get(driver.name) ?? null;
    const asOf = getPayrollAsOfDate(month);
    const fullEmploymentDays = getEmploymentDaysInMonth(driver, month, period);
    const allowanceEmploymentDays = getEmploymentDaysInMonth(driver, month, period, asOf);
    const periodStart = fullEmploymentDays[0] ?? getDefaultPeriodStart(driver, month);
    const periodEnd = fullEmploymentDays[fullEmploymentDays.length - 1] ?? getDefaultPeriodEnd(driver, month);
    const leaveInfo = leaveByDriver.get(driver.name) ?? { leaveDates: new Set(), salaryDeductDates: new Set() };
    const leaveDays = allowanceEmploymentDays.filter((d) => leaveInfo.leaveDates.has(d)).length;
    const salaryLeaveDays = fullEmploymentDays.filter((d) => leaveInfo.salaryDeductDates.has(d)).length;
    const workingDays = allowanceEmploymentDays.length - leaveDays;
    const allowancePaid = allowanceByDriver.get(driver.name) || 0;
    const advancePaid = advanceByDriver.get(driver.name) || 0;
    const salaryPaid = salaryByDriver.get(driver.name) || 0;
    const salaryDefault = driver.monthly_salary ?? 25000;
    const salaryDue = computeSalaryDue(salaryDefault, fullEmploymentDays.length, salaryLeaveDays);
    const dailyRate = driver.daily_allowance ?? 500;
    const allowanceDue = workingDays * dailyRate;
    const allowanceShortfall = Math.max(0, allowanceDue - allowancePaid);
    const daysShortfall = dailyRate > 0 ? Math.ceil(allowanceShortfall / dailyRate) : 0;
    const { gross, balance } = computePayrollTotals({
      salaryDefault,
      salaryDue,
      salaryPaid,
      allowanceDue,
      allowancePaid,
      advancePaid,
    });

    return {
      driver,
      workingDays,
      leaveDays,
      salaryLeaveDays,
      periodStart,
      periodEnd,
      allowancePaid,
      allowanceDue,
      allowanceShortfall,
      daysShortfall,
      advancePaid,
      salaryPaid,
      salaryDefault,
      salaryDue,
      dailyRate,
      gross,
      balance,
      payLines: payLinesByDriver.get(driver.name) ?? [],
    };
  });
}

async function fetchPayExpenseRows(
  month: string,
  periods?: Map<string, DriverPayrollPeriod> | null,
): Promise<PayExpenseRow[]> {
  const { from, to } = payrollQueryRange(month, periods);
  const lookbackFrom = addMonthsToDate(from, -12);
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, person, category, amount, date, description')
    .gte('date', lookbackFrom)
    .lte('date', addCalendarMonthsClamped(to, 1))
    .in('category', [
      DRIVER_PAY_CATEGORIES.allowance,
      DRIVER_PAY_CATEGORIES.advance,
      ...SALARY_CATEGORIES,
    ]);
  return (expenses || []) as PayExpenseRow[];
}

function allocatePayMaps(
  month: string,
  drivers: Driver[],
  periods: Map<string, DriverPayrollPeriod> | null | undefined,
  rows: PayExpenseRow[],
) {
  const allowanceByDriver = new Map<string, number>();
  const advanceByDriver = new Map<string, number>();
  const salaryByDriver = new Map<string, number>();
  const payLinesByDriver = new Map<string, PayrollPayLine[]>();

  for (const driver of drivers) {
    const allocated = allocateDriverPay(driver, month, periods?.get(driver.name), rows);
    allowanceByDriver.set(driver.name, allocated.allowance);
    advanceByDriver.set(driver.name, allocated.advance);
    salaryByDriver.set(driver.name, allocated.salary);
    payLinesByDriver.set(driver.name, allocated.lines);
  }

  return { allowanceByDriver, advanceByDriver, salaryByDriver, payLinesByDriver };
}

export async function fetchInactiveDrivers(): Promise<Driver[]> {
  const all = await fetchDrivers();
  return all.filter((d) => d.status === 'inactive');
}

/** Month to open for an inactive driver's payroll (usually their last working month). */
export function getSuggestedPayrollMonth(driver: Driver): string | null {
  if (driver.left_date) return driver.left_date.slice(0, 7);
  if (driver.joined_date) return driver.joined_date.slice(0, 7);
  return null;
}

export async function fetchMonthlyPayroll(month: string): Promise<MonthlyPayrollRow[]> {
  const allDrivers = await fetchDrivers();
  const savedPeriods = await fetchPayrollPeriods(month);
  const expenseRows = await fetchPayExpenseRows(month, savedPeriods);
  const periodByDriver = withSuggestedPeriods(
    allDrivers,
    month,
    savedPeriods,
    lastSalaryByDriverBefore(expenseRows, getMonthBounds(month).from),
  );
  const drivers = allDrivers.filter(
    (d) =>
      d.status === 'active'
      && isDriverActiveInMonth(d, month, periodByDriver.get(d.name)),
  );
  const leaveByDriver = await fetchLeaveForMonth(month, periodByDriver);
  const { allowanceByDriver, advanceByDriver, salaryByDriver, payLinesByDriver } = allocatePayMaps(
    month,
    drivers,
    periodByDriver,
    expenseRows,
  );

  return buildPayrollRows(
    drivers,
    month,
    periodByDriver,
    leaveByDriver,
    allowanceByDriver,
    advanceByDriver,
    salaryByDriver,
    payLinesByDriver,
  );
}

export async function fetchInactivePayroll(month: string): Promise<MonthlyPayrollRow[]> {
  const allDrivers = await fetchDrivers();
  const savedPeriods = await fetchPayrollPeriods(month);
  const candidates = allDrivers.filter((d) => d.status === 'inactive');
  const expenseRows = await fetchPayExpenseRows(month, savedPeriods);
  const periodByDriver = withSuggestedPeriods(
    candidates,
    month,
    savedPeriods,
    lastSalaryByDriverBefore(expenseRows, getMonthBounds(month).from),
  );
  const leaveByDriver = await fetchLeaveForMonth(month, periodByDriver);
  const { allowanceByDriver, advanceByDriver, salaryByDriver, payLinesByDriver } = allocatePayMaps(
    month,
    candidates,
    periodByDriver,
    expenseRows,
  );

  const drivers = candidates.filter((d) => {
    const period = periodByDriver.get(d.name);
    return (
      isDriverActiveInMonth(d, month, period)
      || hasDriverPayInMonth(d.name, allowanceByDriver, advanceByDriver, salaryByDriver)
    );
  });

  return buildPayrollRows(
    drivers,
    month,
    periodByDriver,
    leaveByDriver,
    allowanceByDriver,
    advanceByDriver,
    salaryByDriver,
    payLinesByDriver,
  );
}

export async function fetchPayLineExpenses(ids: number[]): Promise<Expense[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  const byId = new Map((data || []).map((e) => [e.id as number, e as Expense]));
  return ids.map((id) => byId.get(id)).filter((e): e is Expense => e != null);
}

export async function postDriverExpense(params: {
  date: string;
  driverName: string;
  category: string;
  amount: number;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    date: params.date,
    expense_type: 'operational',
    category: params.category,
    amount: params.amount,
    person: params.driverName,
    description: params.description || null,
    paid_by: 'JM transport',
    status: 'Paid',
    payment_source: 'Partner',
  });
  if (error) throw error;
  await supabase.from('partners').upsert({ name: params.driverName }, { onConflict: 'name' });
}

export async function postDailyAllowance(
  driver: Driver,
  date: string,
  days: number = 1,
  amount?: number,
): Promise<void> {
  const rate = driver.daily_allowance ?? 500;
  const total = amount ?? days * rate;
  const dayLabel = days === 1 ? '1 day' : `${days} days`;
  await postDriverExpense({
    date,
    driverName: driver.name,
    category: DRIVER_PAY_CATEGORIES.allowance,
    amount: total,
    description: `Daily allowance — ${dayLabel}`,
  });
}

export async function postSalary(
  driver: Driver,
  month: string,
  amount: number,
  periodEnd?: string,
): Promise<void> {
  const payDate = periodEnd ?? getMonthBounds(month).to;
  await postDriverExpense({
    date: payDate,
    driverName: driver.name,
    category: DRIVER_PAY_CATEGORIES.salary,
    amount,
    description: `Salary for ${month}`,
  });
}

export async function postAdvance(
  driver: Driver,
  date: string,
  amount: number,
  description?: string,
): Promise<void> {
  await postDriverExpense({
    date,
    driverName: driver.name,
    category: DRIVER_PAY_CATEGORIES.advance,
    amount,
    description: description || 'Advance payment',
  });
}

async function deleteDriverPayExpenses(params: {
  driverName: string;
  dateFrom: string;
  dateTo: string;
  categories: readonly string[];
}): Promise<number> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id')
    .eq('person', params.driverName)
    .gte('date', params.dateFrom)
    .lte('date', params.dateTo)
    .in('category', [...params.categories]);

  if (error) throw error;
  if (!data?.length) return 0;

  const { error: delError } = await supabase
    .from('expenses')
    .delete()
    .in('id', data.map((r) => r.id));

  if (delError) throw delError;
  return data.length;
}

export async function revertSalary(
  driverName: string,
  month: string,
  range?: { from: string; to: string },
): Promise<void> {
  const { from, to } = range ?? getMonthBounds(month);
  const deleted = await deleteDriverPayExpenses({
    driverName,
    dateFrom: from,
    dateTo: to,
    categories: SALARY_CATEGORIES,
  });
  if (deleted === 0) throw new Error('No salary expense found for this month');
}

export async function revertLastAllowance(
  driverName: string,
  month: string,
  range?: { from: string; to: string },
): Promise<void> {
  const { from, to } = range ?? getMonthBounds(month);
  const { data, error } = await supabase
    .from('expenses')
    .select('id')
    .eq('person', driverName)
    .eq('category', DRIVER_PAY_CATEGORIES.allowance)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data?.length) throw new Error('No allowance expense found for this month');

  const { error: delError } = await supabase.from('expenses').delete().eq('id', data[0].id);
  if (delError) throw delError;
}
