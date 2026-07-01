'use client';

import { useEffect, useState } from 'react';
import { supabase, ExpenseType, EXPENSE_TYPES, JM_PARTNERS } from '@/lib/supabase';
import {
  buildCategoriesByType,
  DEFAULT_CATEGORIES_BY_TYPE,
  fetchExpenseCategories,
} from '@/lib/expense-categories';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, CheckCircle2, Pencil, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  expense_type: 'vehicle' as ExpenseType,
  vehicle_number: '',
  category: '',
  amount: '',
  description: '',
  person: '',
  paid_by_person: '',
  paid_by: 'JM transport',
  payment_source: 'Partner',
  payment_mode: 'Cash',
  card_details: '',
};

export default function SubmitExpensePage() {
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [submittedForm, setSubmittedForm] = useState(emptyForm);
  const [categoriesByType, setCategoriesByType] = useState(DEFAULT_CATEGORIES_BY_TYPE);

  useEffect(() => {
    fetchExpenseCategories().then(({ data }) => {
      setCategoriesByType(buildCategoriesByType(data));
    });
  }, []);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: any) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data }) => {
      setPartners((data || []).map((p: any) => p.name));
    });
  }, []);

  function handleTypeChange(type: ExpenseType) {
    const categories = categoriesByType[type];
    setForm((f) => ({
      ...f,
      expense_type: type,
      category: categories.includes(f.category) ? f.category : '',
      vehicle_number: type === 'vehicle' ? f.vehicle_number : '',
      person: type === 'vehicle' ? '' : f.person,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      date: form.date,
      expense_type: form.expense_type,
      vehicle_number: form.expense_type === 'vehicle' ? form.vehicle_number : null,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      person: form.person || null,
      paid_by_person: form.paid_by_person || null,
      paid_by: form.paid_by,
      payment_source: form.payment_source,
      status: 'Paid',
    };

    const { data: inserted, error } = await supabase.from('expenses').insert(payload).select('id').single();

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // If paid by a partner, also create a capital contribution
    if (form.payment_source === 'Partner' && form.paid_by_person) {
      const { error: ccErr } = await supabase.from('capital_contributions').insert({
        date: form.date,
        contributor: form.paid_by_person,
        contribution_type: form.payment_mode,
        value: Number(form.amount),
        description: form.description || form.category,
        asset_details: form.payment_mode === 'Credit Card' ? form.card_details : null,
        status: 'Unpaid',
        paid_by: 'JM transport',
      });
      if (ccErr) toast.error('Expense saved but capital entry failed: ' + ccErr.message);
    }

    setSubmitting(false);
    setSubmittedId(inserted?.id || null);
    setSubmittedForm({ ...form });
    setSubmitted(true);
  }

  function handleEditResponse() {
    // Load the submitted form back for editing
    setForm({ ...submittedForm });
    setSubmitted(false);
  }

  async function handleUpdateSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!submittedId) return;
    setSubmitting(true);

    const payload = {
      date: form.date,
      expense_type: form.expense_type,
      vehicle_number: form.expense_type === 'vehicle' ? form.vehicle_number : null,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      person: form.person || null,
      paid_by_person: form.paid_by_person || null,
      paid_by: form.paid_by,
      payment_source: form.payment_source,
      status: 'Paid',
    };

    const { error } = await supabase.from('expenses').update(payload).eq('id', submittedId);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSubmittedForm({ ...form });
    setSubmitted(true);
    toast.success('Response updated');
  }

  function handleSubmitAnother() {
    setSubmitted(false);
    setSubmittedId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
  }

  const availableCategories = categoriesByType[form.expense_type] || [];

  const typeColors: Record<string, string> = {
    vehicle: 'bg-blue-600 text-white',
    operational: 'bg-green-600 text-white',
    personal: 'bg-purple-600 text-white',
  };

  if (submitted) {
    const sf = submittedForm;
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto pt-8">
          <Card>
            <CardContent className="pt-8 pb-6 px-6">
              <div className="text-center mb-6">
                <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-900">Expense Submitted!</h2>
                <p className="text-sm text-gray-500 mt-1">Your response has been recorded</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-bold text-green-600 text-lg">{formatCurrency(Number(sf.amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="capitalize font-medium">{sf.expense_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span>{sf.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{sf.date}</span>
                </div>
                {sf.vehicle_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vehicle</span>
                    <span>{sf.vehicle_number}</span>
                  </div>
                )}
                {sf.description && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Description</span>
                    <span>{sf.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Entity</span>
                  <span>{sf.paid_by}</span>
                </div>
                {sf.paid_by_person && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid By</span>
                    <span>{sf.paid_by_person}</span>
                  </div>
                )}
                {sf.person && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Given To</span>
                    <span>{sf.person}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid From</span>
                  <span>{sf.payment_source}</span>
                </div>
                {sf.payment_source === 'Partner' && sf.payment_mode && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Mode</span>
                    <span>{sf.payment_mode}{sf.card_details ? ` (${sf.card_details})` : ''}</span>
                  </div>
                )}
                {sf.payment_source === 'Partner' && sf.paid_by_person && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-blue-600 font-medium">Capital contribution of {formatCurrency(Number(sf.amount))} recorded for {sf.paid_by_person}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={handleEditResponse}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Response
                </Button>
                <Button className="flex-1" onClick={handleSubmitAnother}>
                  <Plus className="h-4 w-4 mr-2" /> Submit Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Back + Header */}
        <div className="pt-4 mb-6">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-800 hover:text-blue-600 bg-white border rounded-lg px-3 py-2 shadow-sm mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </a>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-2">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">JM Transport</h1>
            <p className="text-sm text-gray-500">Submit Expense</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 pb-4">
            <form onSubmit={submittedId ? handleUpdateSubmission : handleSubmit} className="space-y-4">
              {/* Expense Type */}
              <div>
                <Label>Expense Type</Label>
                <div className="flex gap-2 mt-1">
                  {EXPENSE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTypeChange(t.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 ${
                        form.expense_type === t.value
                          ? typeColors[t.value]
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount - big and prominent */}
              <div>
                <Label>Amount ({'\u20B9'})</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="text-2xl h-14 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <Label>Category</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select</option>
                    {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Vehicle - only for vehicle type */}
              {form.expense_type === 'vehicle' && (
                <div>
                  <Label>Vehicle</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} required>
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}

              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              {form.expense_type !== 'vehicle' && (
                <div>
                  <Label>Given To</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
                    <option value="">Select</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div>
                <Label>Paid From</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.payment_source} onChange={(e) => setForm({ ...form, payment_source: e.target.value })}>
                  <option value="Partner">Partner</option>
                  <option value="Revenue">Revenue</option>
                </select>
              </div>

              {form.payment_source === 'Partner' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Payment Mode</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  {form.payment_mode === 'Credit Card' && (
                    <div>
                      <Label>Card Details</Label>
                      <Input value={form.card_details} onChange={(e) => setForm({ ...form, card_details: e.target.value })} placeholder="e.g. HDFC CC" />
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base" disabled={submitting}>
                {submitting ? 'Submitting...' : submittedId ? 'Update Expense' : 'Submit Expense'}
              </Button>
              {submittedId && (
                <Button type="button" variant="outline" className="w-full" onClick={handleSubmitAnother}>
                  Cancel Edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-4">
          JM Transport Expense Tracker
        </p>
      </div>
    </div>
  );
}
