import { supabase, type Driver, DRIVER_PAY_CATEGORIES, SALARY_CATEGORIES } from '@/lib/supabase';

export type MonthlyPayrollRow = {
  driver: Driver;
  workingDays: number;
  leaveDays: number;
  periodStart: string;
  periodEnd: string;
  allowancePaid: number;
  allowanceDue: number;
  allowanceShortfall: number;
  daysShortfall: number;
  advancePaid: number;
  salaryPaid: number;
  salaryDefault: number;
  dailyRate: number;
  gross: number;
  balance: number;
};

export type DriverPayrollPeriod = {
  driver_name: string;
  month: string;
  start_date: string;
  end_date: string | null;
};

/** Total payable for the month; optional salary override when not yet posted. */
export function computePayrollTotals(
  row: Pick<
    MonthlyPayrollRow,
    | 'salaryDefault'
    | 'salaryPaid'
    | 'allowanceDue'
    | 'allowancePaid'
    | 'advancePaid'
  >,
  salaryOverride?: number,
): { salaryForMonth: number; gross: number; balance: number } {
  const salaryForMonth =
    row.salaryPaid > 0
      ? row.salaryPaid
      : (salaryOverride != null && salaryOverride > 0 ? salaryOverride : row.salaryDefault);
  const gross = salaryForMonth + row.allowanceDue;
  const balance = gross - row.allowancePaid - row.advancePaid - row.salaryPaid;
  return { salaryForMonth, gross, balance };
}

export function getMonthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-');
  const from = `${y}-${m}-01`;
  const end = new Date(Number(y), Number(m), 0);
  const to = end.toISOString().split('T')[0];
  return { from, to };
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

/** Calendar days in the payroll period. Pass asOfDate to cap at today (current month allowance). */
export function getEmploymentDaysInMonth(
  driver: Driver,
  month: string,
  period?: DriverPayrollPeriod | null,
  asOfDate?: string | null,
): string[] {
  const { from, to } = getMonthBounds(month);
  let start = from;
  let end = to;

  if (period) {
    if (period.start_date > start) start = period.start_date;
    if (period.end_date && period.end_date < end) end = period.end_date;
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
    days.push(cursor.toISOString().split('T')[0]);
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
  const { from, to } = getMonthBounds(month);
  const start = startDate < from ? from : startDate;
  const end = endDate && endDate > to ? to : endDate;

  const { error } = await supabase.from('driver_payroll_period').upsert(
    {
      driver_name: driverName,
      month,
      start_date: start,
      end_date: end,
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

export async function fetchLeaveDatesForMonth(month: string): Promise<Map<string, Set<string>>> {
  const { from, to } = getMonthBounds(month);
  const { data, error } = await supabase
    .from('driver_leave')
    .select('driver_name, date')
    .gte('date', from)
    .lte('date', to);

  const map = new Map<string, Set<string>>();
  if (error) return map;

  for (const row of data || []) {
    if (!map.has(row.driver_name)) map.set(row.driver_name, new Set());
    map.get(row.driver_name)!.add(row.date);
  }
  return map;
}

export async function setDriverLeaveDates(
  driver: Driver,
  month: string,
  leaveDates: string[],
  period?: DriverPayrollPeriod | null,
): Promise<void> {
  const employmentDays = new Set(getEmploymentDaysInMonth(driver, month, period));
  const validLeave = leaveDates.filter((d) => employmentDays.has(d));
  const { from, to } = getMonthBounds(month);

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
    .insert(validLeave.map((date) => ({ driver_name: driver.name, date })));
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

function buildPayrollRows(
  drivers: Driver[],
  month: string,
  periodByDriver: Map<string, DriverPayrollPeriod>,
  leaveByDriver: Map<string, Set<string>>,
  allowanceByDriver: Map<string, number>,
  advanceByDriver: Map<string, number>,
  salaryByDriver: Map<string, number>,
): MonthlyPayrollRow[] {
  return drivers.map((driver) => {
    const period = periodByDriver.get(driver.name) ?? null;
    const asOf = getPayrollAsOfDate(month);
    const fullEmploymentDays = getEmploymentDaysInMonth(driver, month, period);
    const allowanceEmploymentDays = getEmploymentDaysInMonth(driver, month, period, asOf);
    const periodStart = fullEmploymentDays[0] ?? getDefaultPeriodStart(driver, month);
    const periodEnd = fullEmploymentDays[fullEmploymentDays.length - 1] ?? getDefaultPeriodEnd(driver, month);
    const leaveDates = leaveByDriver.get(driver.name) ?? new Set<string>();
    const leaveDays = allowanceEmploymentDays.filter((d) => leaveDates.has(d)).length;
    const workingDays = allowanceEmploymentDays.length - leaveDays;
    const allowancePaid = allowanceByDriver.get(driver.name) || 0;
    const advancePaid = advanceByDriver.get(driver.name) || 0;
    const salaryPaid = salaryByDriver.get(driver.name) || 0;
    const salaryDefault = driver.monthly_salary ?? 25000;
    const dailyRate = driver.daily_allowance ?? 500;
    const allowanceDue = workingDays * dailyRate;
    const allowanceShortfall = Math.max(0, allowanceDue - allowancePaid);
    const daysShortfall = dailyRate > 0 ? Math.ceil(allowanceShortfall / dailyRate) : 0;
    const { gross, balance } = computePayrollTotals({
      salaryDefault,
      salaryPaid,
      allowanceDue,
      allowancePaid,
      advancePaid,
    });

    return {
      driver,
      workingDays,
      leaveDays,
      periodStart,
      periodEnd,
      allowancePaid,
      allowanceDue,
      allowanceShortfall,
      daysShortfall,
      advancePaid,
      salaryPaid,
      salaryDefault,
      dailyRate,
      gross,
      balance,
    };
  });
}

async function fetchPayExpenseMaps(month: string) {
  const { from, to } = getMonthBounds(month);
  const { data: expenses } = await supabase
    .from('expenses')
    .select('person, category, amount, date')
    .gte('date', from)
    .lte('date', to)
    .in('category', [
      DRIVER_PAY_CATEGORIES.allowance,
      DRIVER_PAY_CATEGORIES.advance,
      ...SALARY_CATEGORIES,
    ]);

  const allowanceByDriver = new Map<string, number>();
  const advanceByDriver = new Map<string, number>();
  const salaryByDriver = new Map<string, number>();

  for (const e of expenses || []) {
    if (!e.person) continue;
    const amt = Number(e.amount);
    if (e.category === DRIVER_PAY_CATEGORIES.allowance) {
      allowanceByDriver.set(e.person, (allowanceByDriver.get(e.person) || 0) + amt);
    } else if (e.category === DRIVER_PAY_CATEGORIES.advance) {
      advanceByDriver.set(e.person, (advanceByDriver.get(e.person) || 0) + amt);
    } else if (SALARY_CATEGORIES.includes(e.category as (typeof SALARY_CATEGORIES)[number])) {
      salaryByDriver.set(e.person, (salaryByDriver.get(e.person) || 0) + amt);
    }
  }

  return { allowanceByDriver, advanceByDriver, salaryByDriver };
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
  const periodByDriver = await fetchPayrollPeriods(month);
  const drivers = allDrivers.filter(
    (d) =>
      d.status === 'active'
      && isDriverActiveInMonth(d, month, periodByDriver.get(d.name)),
  );
  const leaveByDriver = await fetchLeaveDatesForMonth(month);
  const { allowanceByDriver, advanceByDriver, salaryByDriver } = await fetchPayExpenseMaps(month);

  return buildPayrollRows(
    drivers,
    month,
    periodByDriver,
    leaveByDriver,
    allowanceByDriver,
    advanceByDriver,
    salaryByDriver,
  );
}

export async function fetchInactivePayroll(month: string): Promise<MonthlyPayrollRow[]> {
  const allDrivers = await fetchDrivers();
  const periodByDriver = await fetchPayrollPeriods(month);
  const leaveByDriver = await fetchLeaveDatesForMonth(month);
  const { allowanceByDriver, advanceByDriver, salaryByDriver } = await fetchPayExpenseMaps(month);

  const drivers = allDrivers.filter((d) => {
    if (d.status !== 'inactive') return false;
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
  );
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

export async function postSalary(driver: Driver, month: string, amount: number): Promise<void> {
  const { to } = getMonthBounds(month);
  await postDriverExpense({
    date: to,
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

export async function revertSalary(driverName: string, month: string): Promise<void> {
  const { from, to } = getMonthBounds(month);
  const deleted = await deleteDriverPayExpenses({
    driverName,
    dateFrom: from,
    dateTo: to,
    categories: SALARY_CATEGORIES,
  });
  if (deleted === 0) throw new Error('No salary expense found for this month');
}

export async function revertLastAllowance(driverName: string, month: string): Promise<void> {
  const { from, to } = getMonthBounds(month);
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
