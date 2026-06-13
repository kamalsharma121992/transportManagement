'use client';

import { useEffect, useState } from 'react';
import { supabase, Expense, ExpenseType, EXPENSE_TYPES, CATEGORIES_BY_TYPE, ALL_CATEGORIES, JM_PARTNERS } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  expense_type: 'vehicle' as ExpenseType,
  vehicle_number: '',
  category: '',
  amount: 0,
  description: '',
  person: '',
  paid_by_person: '',
  bill_receipt_ref: '',
  paid_by: 'JM transport',
  status: 'Paid',
};

const typeColors: Record<string, string> = {
  vehicle: 'bg-blue-100 text-blue-800',
  operational: 'bg-green-100 text-green-800',
  personal: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

const categoryColor: Record<string, string> = {
  'Fuel (Diesel)': 'bg-amber-100 text-amber-800',
  'Maintenance': 'bg-blue-100 text-blue-800',
  'Insurance': 'bg-purple-100 text-purple-800',
  'Toll Taxes': 'bg-red-100 text-red-800',
  'Meals': 'bg-green-100 text-green-800',
  'Rent': 'bg-orange-100 text-orange-800',
  'Daily Allowance': 'bg-teal-100 text-teal-800',
  'Advance': 'bg-red-100 text-red-800',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<ExpenseType | ''>('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [filterPaidByPerson, setFilterPaidByPerson] = useState('');
  const [filterPaidBy, setFilterPaidBy] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const hasActiveFilters = filterType || filterVehicle || filterCategory || filterPerson || filterPaidByPerson || filterPaidBy || filterDateFrom || filterDateTo || filterMonth;

  function clearFilters() {
    setFilterType(''); setFilterVehicle(''); setFilterCategory('');
    setFilterPerson(''); setFilterPaidByPerson(''); setFilterPaidBy('');
    setFilterDateFrom(''); setFilterDateTo(''); setFilterMonth('');
  }

  async function fetchExpenses() {
    let query = supabase.from('expenses').select('*').order('date', { ascending: false });
    if (filterType) query = query.eq('expense_type', filterType);
    if (filterVehicle) query = query.eq('vehicle_number', filterVehicle);
    if (filterCategory) query = query.eq('category', filterCategory);
    if (filterPerson) query = query.eq('person', filterPerson);
    if (filterPaidByPerson) query = query.eq('paid_by_person', filterPaidByPerson);
    if (filterPaidBy) query = query.eq('paid_by', filterPaidBy);
    if (filterMonth) {
      const [y, m] = filterMonth.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
      query = query.gte('date', start).lte('date', end);
    } else {
      if (filterDateFrom) query = query.gte('date', filterDateFrom);
      if (filterDateTo) query = query.lte('date', filterDateTo);
    }
    const { data } = await query;
    setExpenses(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchExpenses();
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: any) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data }) => {
      setPartners((data || []).map((p: any) => p.name));
    });
  }, [filterType, filterVehicle, filterCategory, filterPerson, filterPaidByPerson, filterPaidBy, filterDateFrom, filterDateTo, filterMonth]);

  function handleTypeChange(type: ExpenseType) {
    const categories = CATEGORIES_BY_TYPE[type];
    setForm((f) => ({
      ...f,
      expense_type: type,
      category: categories.includes(f.category) ? f.category : '',
      vehicle_number: type === 'vehicle' ? f.vehicle_number : '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      vehicle_number: form.expense_type === 'vehicle' ? form.vehicle_number : null,
      person: form.person || null,
      paid_by_person: form.paid_by_person || null,
    };
    if (editingId) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Expense updated');
    } else {
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Expense added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchExpenses();
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      date: exp.date,
      expense_type: exp.expense_type,
      vehicle_number: exp.vehicle_number || '',
      category: exp.category,
      amount: Number(exp.amount),
      description: exp.description || '',
      person: exp.person || '',
      paid_by_person: exp.paid_by_person || '',
      bill_receipt_ref: exp.bill_receipt_ref || '',
      paid_by: exp.paid_by,
      status: exp.status,
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Expense deleted');
    fetchExpenses();
  }

  const totalFiltered = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const jmTotal = expenses.filter(e => e.paid_by === 'JM transport').reduce((s, e) => s + Number(e.amount), 0);
  const maheshTotal = expenses.filter(e => e.paid_by === 'Mahesh').reduce((s, e) => s + Number(e.amount), 0);
  const availableCategories = form.expense_type ? CATEGORIES_BY_TYPE[form.expense_type] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Expense' : 'New Expense'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Expense Type</Label>
                  <div className="flex gap-2 mt-1">
                    {EXPENSE_TYPES.map((t) => (
                      <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${form.expense_type === t.value ? typeColors[t.value] : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                {form.expense_type === 'vehicle' && (
                  <div>
                    <Label>Vehicle</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} required>
                      <option value="">Select</option>
                      {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <Label>Category</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select</option>
                    {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Amount ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label>Paid By (Entity)</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}>
                    <option value="JM transport">JM Transport</option>
                    <option value="Mahesh">Mahesh</option>
                  </select>
                </div>
                <div>
                  <Label>Paid By (Person)</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paid_by_person} onChange={(e) => setForm({ ...form, paid_by_person: e.target.value })}>
                    <option value="">Select</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Given To</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
                    <option value="">Select</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Expense</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalFiltered)}</p>
            <p className="text-xs text-gray-400">{expenses.length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-sky-600 uppercase tracking-wide">JM Transport</p>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(jmTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-orange-600 uppercase tracking-wide">Mahesh</p>
            <p className="text-2xl font-bold text-orange-700">{formatCurrency(maheshTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          All
        </button>
        {EXPENSE_TYPES.map((t) => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="space-y-2">
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium">
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Advanced Filters
          {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">Active</span>}
        </button>

        {showFilters && (
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Month</label>
                  <Input type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setFilterDateFrom(''); setFilterDateTo(''); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date From</label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setFilterMonth(''); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date To</label>
                  <Input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setFilterMonth(''); }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Entity</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
                    <option value="">All</option>
                    <option value="JM transport">JM Transport</option>
                    <option value="Mahesh">Mahesh</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Who Paid</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterPaidByPerson} onChange={(e) => setFilterPaidByPerson(e.target.value)}>
                    <option value="">All</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Given To</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
                    <option value="">All</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Vehicle</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                    <option value="">All</option>
                    {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">All</option>
                    {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                  <X className="h-3 w-3" /> Clear all filters
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Given To</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">No expenses found</TableCell></TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(exp.date)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[exp.expense_type]}`}>
                          {exp.expense_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {exp.vehicle_number ? <Badge variant="outline">{exp.vehicle_number}</Badge> : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColor[exp.category] || 'bg-gray-100 text-gray-800'}`}>
                          {exp.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 whitespace-nowrap">{formatCurrency(Number(exp.amount))}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{exp.description}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.paid_by === 'Mahesh' ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'}`}>
                          {exp.paid_by === 'JM transport' ? 'JM' : 'Mahesh'}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{exp.paid_by_person || <span className="text-gray-300">-</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">{exp.person || <span className="text-gray-300">-</span>}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(exp)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
