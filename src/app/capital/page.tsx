'use client';

import { useEffect, useState } from 'react';
import { supabase, CapitalContribution, JM_PARTNERS, PAYMENT_SOURCES } from '@/lib/supabase';
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
import { Plus, Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  contributor: '',
  contribution_type: 'Credit Card',
  value: 0,
  description: '',
  asset_details: '',
  status: 'Unpaid',
  paid_date: '',
  paid_by: 'JM transport',
};

export default function CapitalPage() {
  const [contributions, setContributions] = useState<CapitalContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [payForm, setPayForm] = useState({ paid_date: new Date().toISOString().split('T')[0], paid_by: 'JM transport', payment_source: 'Revenue' });
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterContributor, setFilterContributor] = useState('');

  async function fetchData() {
    let query = supabase.from('capital_contributions').select('*').order('date', { ascending: false });
    if (filterStatus) query = query.eq('status', filterStatus);
    if (filterContributor) query = query.eq('contributor', filterContributor);
    const { data } = await query;
    setContributions(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [filterStatus, filterContributor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      paid_date: form.status === 'Paid' ? (form.paid_date || form.date) : null,
    };
    if (editingId) {
      const { error } = await supabase.from('capital_contributions').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Contribution updated');
    } else {
      const { error } = await supabase.from('capital_contributions').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Contribution added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchData();
  }

  function startEdit(c: CapitalContribution) {
    setEditingId(c.id);
    setForm({
      date: c.date,
      contributor: c.contributor,
      contribution_type: c.contribution_type,
      value: Number(c.value),
      description: c.description || '',
      asset_details: c.asset_details || '',
      status: c.status,
      paid_date: c.paid_date || '',
      paid_by: c.paid_by || 'JM transport',
    });
    setDialogOpen(true);
  }

  function startPay(c: CapitalContribution) {
    setPayingId(c.id);
    setPayForm({ paid_date: new Date().toISOString().split('T')[0], paid_by: 'JM transport', payment_source: 'Revenue' });
    setPayDialogOpen(true);
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!payingId) return;
    const { error } = await supabase.from('capital_contributions')
      .update({ status: 'Paid', paid_date: payForm.paid_date, paid_by: payForm.paid_by, payment_source: payForm.payment_source })
      .eq('id', payingId);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as paid');
    setPayDialogOpen(false);
    setPayingId(null);
    fetchData();
  }

  async function handleMarkUnpaid(id: number) {
    const { error } = await supabase.from('capital_contributions')
      .update({ status: 'Unpaid', paid_date: null })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as unpaid');
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this contribution?')) return;
    const { error } = await supabase.from('capital_contributions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Contribution deleted');
    fetchData();
  }

  // Summary
  const totalContributions = contributions.reduce((sum, c) => sum + Number(c.value), 0);
  const paidTotal = contributions.filter(c => c.status === 'Paid').reduce((sum, c) => sum + Number(c.value), 0);
  const unpaidTotal = contributions.filter(c => c.status !== 'Paid').reduce((sum, c) => sum + Number(c.value), 0);

  const contributorTotals: Record<string, { total: number; paid: number; unpaid: number }> = {};
  contributions.forEach((c) => {
    if (!contributorTotals[c.contributor]) contributorTotals[c.contributor] = { total: 0, paid: 0, unpaid: 0 };
    const amt = Number(c.value);
    contributorTotals[c.contributor].total += amt;
    if (c.status === 'Paid') contributorTotals[c.contributor].paid += amt;
    else contributorTotals[c.contributor].unpaid += amt;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Capital Contributions</h1>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Contribution
        </Button>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Contribution' : 'New Contribution'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <Label>Contributor</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.contributor} onChange={(e) => setForm({ ...form, contributor: e.target.value })} required>
                    <option value="">Select</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.contribution_type} onChange={(e) => setForm({ ...form, contribution_type: e.target.value })}>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <Label>Amount ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Asset/Card Details</Label>
                  <Input value={form.asset_details} onChange={(e) => setForm({ ...form, asset_details: e.target.value })} placeholder="e.g. HDFC CC" />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Contribution</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Mark as Paid Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open) setPayingId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} required />
              </div>
              <div>
                <Label>Paid From</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={payForm.payment_source} onChange={(e) => setPayForm({ ...payForm, payment_source: e.target.value })}>
                  {PAYMENT_SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Confirm Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Contributed</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalContributions)}</p>
            <p className="text-xs text-gray-400">{contributions.length} entries</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs text-green-600 uppercase tracking-wide">Paid Back</p>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(paidTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-600 uppercase tracking-wide">Unpaid</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(unpaidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-contributor breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(contributorTotals).map(([name, t]) => (
          <Card key={name}>
            <CardContent className="py-3 px-4">
              <p className="text-sm font-medium text-gray-700">{name}</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(t.total)}</p>
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-green-600">{formatCurrency(t.paid)} paid</span>
                <span className="text-amber-600">{formatCurrency(t.unpaid)} due</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            All
          </button>
          <button onClick={() => setFilterStatus('Unpaid')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === 'Unpaid' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}>
            Unpaid
          </button>
          <button onClick={() => setFilterStatus('Paid')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === 'Paid' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>
            Paid
          </button>
        </div>
        <select className="border rounded-md px-3 py-2 text-sm" value={filterContributor} onChange={(e) => setFilterContributor(e.target.value)}>
          <option value="">All Contributors</option>
          {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contributor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Card/Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid From</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : contributions.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">No contributions found</TableCell></TableRow>
                ) : (
                  contributions.map((c) => (
                    <TableRow key={c.id} className={c.status === 'Paid' ? 'bg-green-50/50' : ''}>
                      <TableCell className="whitespace-nowrap">{formatDate(c.date)}</TableCell>
                      <TableCell className="font-medium">{c.contributor}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {c.contribution_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600 whitespace-nowrap">{formatCurrency(Number(c.value))}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{c.description}</TableCell>
                      <TableCell className="text-gray-500">{c.asset_details}</TableCell>
                      <TableCell>
                        {c.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3" /> Unpaid
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.payment_source ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.payment_source === 'Revenue' ? 'bg-green-100 text-green-800' : 'bg-violet-100 text-violet-800'}`}>
                            {c.payment_source}
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-500">
                        {c.paid_date ? formatDate(c.paid_date) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.status !== 'Paid' ? (
                            <Button variant="ghost" size="icon" onClick={() => startPay(c)} title="Mark as Paid">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleMarkUnpaid(c.id)} title="Mark as Unpaid">
                              <Clock className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
