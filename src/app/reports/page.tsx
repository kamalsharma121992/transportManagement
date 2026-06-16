'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { supabase, PAID_BY_ENTITIES } from '@/lib/supabase';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  buildReportFilters,
  downloadCsv,
  fetchDailyTripReport,
  fetchMonthlyPlReport,
  fetchVehiclePlReport,
  type DailyTripDay,
  type MonthlyPlReport,
  type VehiclePlRow,
} from '@/lib/reports';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'monthly' | 'vehicle' | 'daily';

const emptyMonthly: MonthlyPlReport = {
  tripCount: 0,
  totalRevenue: 0,
  totalExpenses: 0,
  netProfit: 0,
  jmTotal: 0,
  maheshTotal: 0,
  expensesByType: [],
  expensesByCategory: [],
  expensesByEntity: [],
};

export default function ReportsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [tab, setTab] = useState<Tab>('monthly');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const [monthly, setMonthly] = useState<MonthlyPlReport>(emptyMonthly);
  const [vehiclePl, setVehiclePl] = useState<VehiclePlRow[]>([]);
  const [daily, setDaily] = useState<DailyTripDay[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const hasActiveFilters =
    filterMonth !== currentMonth ||
    !!filterDateFrom ||
    !!filterDateTo ||
    !!filterVehicle ||
    !!filterEntity;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterVehicle('');
    setFilterEntity('');
  }

  const activeFilterLabels: string[] = [];
  if (filterMonth) {
    const d = new Date(filterMonth + '-01');
    activeFilterLabels.push(d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  } else if (!filterDateFrom && !filterDateTo) {
    activeFilterLabels.push('All months');
  }
  if (filterDateFrom) activeFilterLabels.push('From: ' + filterDateFrom);
  if (filterDateTo) activeFilterLabels.push('To: ' + filterDateTo);
  if (filterVehicle) activeFilterLabels.push('Vehicle: ' + filterVehicle);
  if (filterEntity) activeFilterLabels.push('Entity: ' + filterEntity);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').order('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
  }, []);

  useEffect(() => {
    async function load() {
      if (hasLoadedRef.current) setRefreshing(true);
      else setLoading(true);

      const filters = buildReportFilters(filterMonth, filterDateFrom, filterDateTo, filterVehicle, filterEntity);

      try {
        const [m, v, d] = await Promise.all([
          fetchMonthlyPlReport(filters),
          fetchVehiclePlReport(filters),
          fetchDailyTripReport(filters),
        ]);
        setMonthly(m);
        setVehiclePl(v);
        setDaily(d);
        hasLoadedRef.current = true;
      } catch {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }
    load();
  }, [filterMonth, filterDateFrom, filterDateTo, filterVehicle, filterEntity]);

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function exportMonthlyCsv() {
    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Trips', String(monthly.tripCount)],
      ['Total Revenue', String(monthly.totalRevenue)],
      ['Total Expenses', String(monthly.totalExpenses)],
      ['Net Profit', String(monthly.netProfit)],
      ['JM Transport', String(monthly.jmTotal)],
      ['Mahesh', String(monthly.maheshTotal)],
      [],
      ['Expense Type', 'Amount'],
      ...monthly.expensesByType.map((r) => [r.type, String(r.amount)]),
      [],
      ['Category', 'Amount'],
      ...monthly.expensesByCategory.map((r) => [r.category, String(r.amount)]),
    ];
    downloadCsv(`monthly-pl-${filterMonth || 'custom'}.csv`, rows);
  }

  function exportVehicleCsv() {
    const rows: string[][] = [
      ['Vehicle', 'Trips', 'Weight (t)', 'Revenue', 'Vehicle Expenses', 'Net Profit'],
      ...vehiclePl.map((r) => [
        r.vehicle,
        String(r.tripCount),
        String(r.totalWeight),
        String(r.revenue),
        String(r.vehicleExpenses),
        String(r.netProfit),
      ]),
    ];
    downloadCsv(`vehicle-pl-${filterMonth || 'custom'}.csv`, rows);
  }

  function exportDailyCsv() {
    const rows: string[][] = [
      ['Date', 'Trips', 'Weight (t)', 'Revenue', 'Vehicle Expenses', 'Net Profit'],
      ...daily.map((d) => [
        d.date,
        String(d.tripCount),
        String(d.totalWeight),
        String(d.revenue),
        String(d.vehicleExpenses),
        String(d.netProfit),
      ]),
    ];
    downloadCsv(`daily-trips-${filterMonth || 'custom'}.csv`, rows);
  }

  function handleExport() {
    if (tab === 'monthly') exportMonthlyCsv();
    else if (tab === 'vehicle') exportVehicleCsv();
    else exportDailyCsv();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'monthly', label: 'Monthly P&L' },
    { id: 'vehicle', label: 'Vehicle P&L' },
    { id: 'daily', label: 'Daily Trips' },
  ];

  return (
    <div className="space-y-6 print:space-y-4" id="reports-content">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          clearFiltersLabel="Reset filters"
          filterLabels={activeFilterLabels}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            </div>
          }
        />
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">JM Transport — Reports</h1>
        <p className="text-sm text-gray-600">{activeFilterLabels.join(' · ')}</p>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Month</label>
              <select
                className={FILTER_SELECT_CLASS}
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setFilterDateFrom(''); setFilterDateTo(''); }}
              >
                {getMonthFilterOptions().map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
              <input
                type="date"
                className={FILTER_SELECT_CLASS}
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setFilterMonth(''); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
              <input
                type="date"
                className={FILTER_SELECT_CLASS}
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setFilterMonth(''); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Vehicle</label>
              <select className={FILTER_SELECT_CLASS} value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                <option value="">All vehicles</option>
                {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Entity (expenses)</label>
              <select className={FILTER_SELECT_CLASS} value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
                <option value="">All entities</option>
                {PAID_BY_ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b print:hidden">
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

      <div className={cn('transition-opacity', refreshing && 'opacity-60')}>
        {loading ? (
          <p className="text-gray-500 text-sm py-8 text-center">Loading reports…</p>
        ) : (
          <>
            {/* Monthly P&L */}
            <div className={tab === 'monthly' ? 'space-y-6' : 'hidden'}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard title="Trips" value={String(monthly.tripCount)} />
                  <SummaryCard title="Revenue" value={formatCurrency(monthly.totalRevenue)} positive />
                  <SummaryCard title="Expenses" value={formatCurrency(monthly.totalExpenses)} negative />
                  <SummaryCard
                    title="Net Profit"
                    value={formatCurrency(monthly.netProfit)}
                    positive={monthly.netProfit >= 0}
                    negative={monthly.netProfit < 0}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">By Entity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>JM Transport</span>
                          <span className="font-medium">{formatCurrency(monthly.jmTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mahesh</span>
                          <span className="font-medium">{formatCurrency(monthly.maheshTotal)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">By Expense Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {monthly.expensesByType.length === 0 ? (
                        <p className="text-sm text-gray-500">No expenses in range</p>
                      ) : (
                        <div className="space-y-2 text-sm">
                          {monthly.expensesByType.map((r) => (
                            <div key={r.type} className="flex justify-between capitalize">
                              <span>{r.type}</span>
                              <span className="font-medium">{formatCurrency(r.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthly.expensesByCategory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-gray-500">No data</TableCell>
                          </TableRow>
                        ) : (
                          monthly.expensesByCategory.map((r) => (
                            <TableRow key={r.category}>
                              <TableCell>{r.category}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

            {/* Vehicle P&L */}
            <div className={tab === 'vehicle' ? '' : 'hidden'}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Per-Vehicle Profit & Loss</CardTitle>
                  <p className="text-xs text-gray-500">Vehicle expenses only (operational costs not allocated)</p>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Trips</TableHead>
                        <TableHead className="text-right">Weight (t)</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Vehicle Exp.</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehiclePl.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-500">No data in range</TableCell>
                        </TableRow>
                      ) : (
                        vehiclePl.map((r) => (
                          <TableRow key={r.vehicle}>
                            <TableCell className="font-medium">{r.vehicle}</TableCell>
                            <TableCell className="text-right">{r.tripCount}</TableCell>
                            <TableCell className="text-right">{r.totalWeight.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                            <TableCell className="text-right text-red-600">{formatCurrency(r.vehicleExpenses)}</TableCell>
                            <TableCell className={cn('text-right font-medium', r.netProfit >= 0 ? 'text-green-700' : 'text-red-600')}>
                              {formatCurrency(r.netProfit)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Daily Trips */}
            <div className={tab === 'daily' ? '' : 'hidden'}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Daily Trip Register</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 print:hidden" />
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Trips</TableHead>
                        <TableHead className="text-right">Weight (t)</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Vehicle Exp.</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daily.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-500">No trips in range</TableCell>
                        </TableRow>
                      ) : (
                        daily.map((d) => {
                          const expanded = expandedDays.has(d.date);
                          return (
                            <Fragment key={d.date}>
                              <TableRow className="cursor-pointer hover:bg-gray-50 print:hover:bg-transparent" onClick={() => toggleDay(d.date)}>
                                <TableCell className="print:hidden">
                                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </TableCell>
                                <TableCell className="font-medium">{formatDate(d.date)}</TableCell>
                                <TableCell className="text-right">{d.tripCount}</TableCell>
                                <TableCell className="text-right">{d.totalWeight.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(d.revenue)}</TableCell>
                                <TableCell className="text-right text-red-600">{formatCurrency(d.vehicleExpenses)}</TableCell>
                                <TableCell className={cn('text-right font-medium', d.netProfit >= 0 ? 'text-green-700' : 'text-red-600')}>
                                  {formatCurrency(d.netProfit)}
                                </TableCell>
                              </TableRow>
                              {expanded && (
                                <TableRow className="bg-gray-50 print:table-row">
                                  <TableCell colSpan={7} className="p-0">
                                    <div className="p-4 space-y-4">
                                      {d.trips.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Trips</p>
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Vehicle</TableHead>
                                                <TableHead>Route</TableHead>
                                                <TableHead>Driver</TableHead>
                                                <TableHead className="text-right">Weight</TableHead>
                                                <TableHead className="text-right">Rate</TableHead>
                                                <TableHead className="text-right">Revenue</TableHead>
                                                <TableHead className="text-right">Advance</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {d.trips.map((t) => (
                                                <TableRow key={t.id}>
                                                  <TableCell>{t.vehicle_number}</TableCell>
                                                  <TableCell>{t.route_name}</TableCell>
                                                  <TableCell>{t.driver_name}</TableCell>
                                                  <TableCell className="text-right">{t.weight_tons}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(t.rate_per_ton)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(t.total_revenue)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(t.advance_paid)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(t.balance_due)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                      {d.expenses.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Vehicle Expenses</p>
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Vehicle</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {d.expenses.map((e, i) => (
                                                <TableRow key={i}>
                                                  <TableCell>{e.vehicle_number || '—'}</TableCell>
                                                  <TableCell>{e.category}</TableCell>
                                                  <TableCell className="text-gray-600">{e.description || '—'}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-gray-500 uppercase">{title}</p>
        <p className={cn(
          'text-2xl font-bold mt-1',
          positive && 'text-green-700',
          negative && 'text-red-600',
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
