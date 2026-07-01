'use client';

import { useEffect, useState } from 'react';
import { supabase, Route, Driver, Partner, JM_PARTNERS, PAID_BY_ENTITIES, EXPENSE_TYPES, type ExpenseType } from '@/lib/supabase';
import { type ExpenseCategory } from '@/lib/expense-categories';
import {
  CARD_NETWORKS,
  buildCardLabel,
  type CreditCard as CreditCardRow,
} from '@/lib/credit-cards';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Route as RouteIcon, Users, Handshake, UserX, Tags, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';

type Tab = 'routes' | 'drivers' | 'partners' | 'categories' | 'credit_cards';

// ─── Routes Section ───
function RoutesSection() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ origin: '', destination: '', route_name: '', distance_km: 0, standard_rate_per_ton: 0 });

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalRoutes,
    setTotalItems: setTotalRoutes,
    totalPages,
  } = useServerPagination();

  async function fetch() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);
    const { data, count } = await supabase
      .from('routes')
      .select('*', { count: 'exact' })
      .order('route_name')
      .range(from, to);
    setRoutes(data || []);
    setTotalRoutes(count ?? 0);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [page, pageSize]);

  function autoName(origin: string, destination: string) {
    const name = origin && destination ? `${origin.toLowerCase()}-${destination.toLowerCase()}` : '';
    setForm(f => ({ ...f, origin, destination, route_name: name }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase.from('routes').update(form).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Route updated');
    } else {
      const { error } = await supabase.from('routes').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Route added');
    }
    setDialogOpen(false); setEditingId(null);
    setForm({ origin: '', destination: '', route_name: '', distance_km: 0, standard_rate_per_ton: 0 });
    fetch();
  }

  function startEdit(r: Route) {
    setEditingId(r.id);
    setForm({ origin: r.origin, destination: r.destination, route_name: r.route_name, distance_km: Number(r.distance_km), standard_rate_per_ton: Number(r.standard_rate_per_ton) });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this route? This will fail if trips reference it.')) return;
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Route deleted');
    fetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{totalRoutes} routes</p>
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ origin: '', destination: '', route_name: '', distance_km: 0, standard_rate_per_ton: 0 }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Route
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Route' : 'New Route'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Origin</Label>
                  <Input value={form.origin} onChange={(e) => autoName(e.target.value, form.destination)} required />
                </div>
                <div>
                  <Label>Destination</Label>
                  <Input value={form.destination} onChange={(e) => autoName(form.origin, e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <Label>Route Name</Label>
                  <Input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Distance (KM)</Label>
                  <Input type="number" step="0.01" value={form.distance_km || ''} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} required />
                </div>
                <div>
                  <Label>Rate/Ton ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.standard_rate_per_ton || ''} onChange={(e) => setForm({ ...form, standard_rate_per_ton: Number(e.target.value) })} required />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Route</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route Name</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead className="text-right">Rate/Ton</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : routes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-500">No routes</TableCell></TableRow>
              ) : routes.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.route_name}</TableCell>
                  <TableCell>{r.origin}</TableCell>
                  <TableCell>{r.destination}</TableCell>
                  <TableCell className="text-right">{Number(r.distance_km)} km</TableCell>
                  <TableCell className="text-right">{'\u20B9'}{Number(r.standard_rate_per_ton)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={totalRoutes}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Drivers Section ───
const emptyDriverForm = {
  name: '',
  phone: '',
  joined_date: '',
  monthly_salary: '25000',
  daily_allowance: '500',
  settlement_notes: '',
};

function DriversSection() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [leavingDriver, setLeavingDriver] = useState<Driver | null>(null);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveNotes, setLeaveNotes] = useState('');
  const [form, setForm] = useState(emptyDriverForm);

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalDrivers,
    setTotalItems: setTotalDrivers,
    totalPages,
  } = useServerPagination();

  async function fetch() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);
    const { data, count } = await supabase
      .from('drivers')
      .select('*', { count: 'exact' })
      .order('name')
      .range(from, to);
    setDrivers(data || []);
    setTotalDrivers(count ?? 0);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [page, pageSize]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      phone: form.phone || null,
      monthly_salary: Number(form.monthly_salary) || 25000,
      daily_allowance: Number(form.daily_allowance) || 500,
      settlement_notes: form.settlement_notes || null,
      status: 'active' as const,
    };
    if (editingId) {
      const { error } = await supabase.from('drivers').update({
        phone: payload.phone,
        joined_date: form.joined_date || null,
        monthly_salary: payload.monthly_salary,
        daily_allowance: payload.daily_allowance,
        settlement_notes: payload.settlement_notes,
      }).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Driver updated');
    } else {
      const { error } = await supabase.from('drivers').insert({
        ...payload,
        joined_date: form.joined_date || null,
      });
      if (error) { toast.error(error.message); return; }
      await supabase.from('partners').upsert({ name: form.name }, { onConflict: 'name' });
      toast.success('Driver added');
    }
    setDialogOpen(false); setEditingId(null);
    setForm(emptyDriverForm);
    fetch();
  }

  function startEdit(d: Driver) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      phone: d.phone || '',
      joined_date: d.joined_date || '',
      monthly_salary: String(d.monthly_salary ?? 25000),
      daily_allowance: String(d.daily_allowance ?? 500),
      settlement_notes: d.settlement_notes || '',
    });
    setDialogOpen(true);
  }

  function openLeaveDialog(d: Driver) {
    setLeavingDriver(d);
    setLeaveDate(new Date().toISOString().split('T')[0]);
    setLeaveNotes('');
    setLeaveDialogOpen(true);
  }

  async function handleMarkLeft(e: React.FormEvent) {
    e.preventDefault();
    if (!leavingDriver) return;
    const { error } = await supabase.from('drivers').update({
      status: 'inactive',
      left_date: leaveDate,
      settlement_notes: leaveNotes || leavingDriver.settlement_notes || 'Left company',
    }).eq('id', leavingDriver.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${leavingDriver.name} marked as inactive`);
    setLeaveDialogOpen(false);
    setLeavingDriver(null);
    fetch();
  }

  async function handleReactivate(d: Driver) {
    const { error } = await supabase.from('drivers').update({
      status: 'active',
      left_date: null,
    }).eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${d.name} reactivated`);
    fetch();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this driver? This will fail if trips reference them.')) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Driver deleted');
    fetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{totalDrivers} drivers</p>
        <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyDriverForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Driver
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Driver' : 'New Driver'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!!editingId} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Joined date</Label>
                <Input
                  type="date"
                  value={form.joined_date}
                  onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly salary (₹)</Label>
                  <Input type="number" min={0} value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
                </div>
                <div>
                  <Label>Daily allowance (₹)</Label>
                  <Input type="number" min={0} value={form.daily_allowance} onChange={(e) => setForm({ ...form, daily_allowance: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.settlement_notes} onChange={(e) => setForm({ ...form, settlement_notes: e.target.value })} placeholder="Optional" />
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Driver</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark as left — {leavingDriver?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMarkLeft} className="space-y-4">
              <div>
                <Label>Last working day</Label>
                <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required />
              </div>
              <div>
                <Label>Settlement notes</Label>
                <Input value={leaveNotes} onChange={(e) => setLeaveNotes(e.target.value)} placeholder="e.g. Full & final settled" />
              </div>
              <Button type="submit" className="w-full">Mark inactive</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Allowance</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : drivers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-500">No drivers</TableCell></TableRow>
              ) : drivers.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.name}
                    {d.settlement_notes && (
                      <p className="text-xs text-gray-500 font-normal truncate max-w-[160px]">{d.settlement_notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.status === 'inactive' ? (
                      <Badge variant="outline" className="text-gray-600">Inactive</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">₹{Number(d.monthly_salary ?? 25000).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right text-sm">₹{Number(d.daily_allowance ?? 500).toLocaleString('en-IN')}/day</TableCell>
                  <TableCell>{d.phone || <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      {d.status === 'inactive' ? (
                        <Button variant="ghost" size="icon" title="Reactivate" onClick={() => handleReactivate(d)}>
                          <Users className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Mark as left" onClick={() => openLeaveDialog(d)}>
                          <UserX className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={totalDrivers}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Partners Section ───
function PartnersSection() {
  const [corePartners, setCorePartners] = useState<Partner[]>([]);
  const [others, setOthers] = useState<Partner[]>([]);
  const [totalPartners, setTotalPartners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '' });

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalOthers,
    setTotalItems: setTotalOthers,
    totalPages,
  } = useServerPagination();

  const coreNames = [...PAID_BY_ENTITIES, ...JM_PARTNERS];

  async function fetch() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);

    const [{ data: core }, { data: otherRows, count }, { count: allCount }] = await Promise.all([
      supabase.from('partners').select('*').in('name', coreNames).order('name'),
      (() => {
        let q = supabase.from('partners').select('*', { count: 'exact' }).order('name');
        for (const name of coreNames) q = q.neq('name', name);
        return q.range(from, to);
      })(),
      supabase.from('partners').select('*', { count: 'exact', head: true }),
    ]);

    setCorePartners(core || []);
    setOthers(otherRows || []);
    setTotalOthers(count ?? 0);
    setTotalPartners(allCount ?? 0);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [page, pageSize]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('partners').insert({ name: form.name });
    if (error) { toast.error(error.message); return; }
    toast.success('Partner added');
    setDialogOpen(false);
    setForm({ name: '' });
    fetch();
  }

  async function handleDelete(id: number, name: string) {
    if (PAID_BY_ENTITIES.includes(name as any) || JM_PARTNERS.includes(name as any)) {
      toast.error(`Cannot delete "${name}" — core entity/partner`);
      return;
    }
    if (!confirm(`Delete "${name}"? This will fail if expenses or contributions reference them.`)) return;
    const { error } = await supabase.from('partners').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Partner deleted');
    fetch();
  }

  const entities = corePartners.filter(p => PAID_BY_ENTITIES.includes(p.name as typeof PAID_BY_ENTITIES[number]));
  const jmPartners = corePartners.filter(p => (JM_PARTNERS as readonly string[]).includes(p.name));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{totalPartners} partners</p>
        <Button size="sm" onClick={() => { setForm({ name: '' }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Partner
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>New Partner</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ name: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Add Partner</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entities */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 uppercase tracking-wide">Entities (Paid By)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {entities.map(p => (
              <span key={p.id} className="px-3 py-1.5 bg-sky-100 text-sky-800 rounded-full text-sm font-medium">{p.name}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* JM Partners */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 uppercase tracking-wide">JM Transport Partners</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {jmPartners.map(p => (
              <span key={p.id} className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{p.name}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Others (drivers, groups, etc) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 uppercase tracking-wide">Others (Drivers, Groups)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={2} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : others.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-6 text-gray-500">No other partners</TableCell></TableRow>
              ) : others.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={totalOthers}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const emptyCreditCardForm = {
  holder: '',
  bank_name: '',
  network: 'VISA' as (typeof CARD_NETWORKS)[number],
  last_four: '',
  label: '',
  is_active: true,
};

// ─── Credit Cards Section ───
function CreditCardsSection() {
  const [cards, setCards] = useState<CreditCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterHolder, setFilterHolder] = useState('');
  const [form, setForm] = useState(emptyCreditCardForm);
  const [tableMissing, setTableMissing] = useState(false);

  async function fetchCards() {
    setLoading(true);
    const { data, error } = await supabase
      .from('credit_cards')
      .select('id, holder, bank_name, network, last_four, label, is_active')
      .order('holder')
      .order('bank_name')
      .order('network');

    if (error) {
      if (error.message.includes('credit_cards') || error.message.includes('schema cache')) {
        setTableMissing(true);
        setCards([]);
      } else {
        toast.error(error.message);
      }
    } else {
      setTableMissing(false);
      setCards((data as CreditCardRow[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCards(); }, []);

  const filtered = filterHolder ? cards.filter((c) => c.holder === filterHolder) : cards;

  function previewLabel(f: typeof emptyCreditCardForm) {
    if (!f.holder || !f.bank_name || !f.network) return '';
    return buildCardLabel(f.bank_name, f.network, f.holder, f.last_four);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const label = form.label.trim() || previewLabel(form);
    if (!form.holder || !form.bank_name || !label) {
      toast.error('Holder, bank, and network are required');
      return;
    }

    const payload = {
      holder: form.holder,
      bank_name: form.bank_name.trim(),
      network: form.network,
      last_four: form.last_four.trim(),
      label,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Credit card updated');
    } else {
      const { error } = await supabase.from('credit_cards').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Credit card added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCreditCardForm);
    fetchCards();
  }

  function startEdit(card: CreditCardRow) {
    setEditingId(card.id);
    setForm({
      holder: card.holder,
      bank_name: card.bank_name,
      network: card.network as (typeof CARD_NETWORKS)[number],
      last_four: card.last_four,
      label: card.label,
      is_active: card.is_active,
    });
    setDialogOpen(true);
  }

  async function handleDelete(card: CreditCardRow) {
    const [{ count: expCount }, { count: capCount }] = await Promise.all([
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('card_id', card.id),
      supabase.from('capital_contributions').select('*', { count: 'exact', head: true }).eq('card_id', card.id),
    ]);

    if ((expCount || 0) + (capCount || 0) > 0) {
      toast.error(`Cannot delete — used in ${expCount || 0} expense(s) and ${capCount || 0} capital row(s)`);
      return;
    }
    if (!confirm(`Delete card "${card.label}"?`)) return;

    const { error } = await supabase.from('credit_cards').delete().eq('id', card.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Credit card deleted');
    fetchCards();
  }

  if (tableMissing) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-gray-600">
          Credit cards table not found. Run <code className="text-xs bg-gray-100 px-1 rounded">supabase/credit_cards.sql</code> in Supabase SQL Editor.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-gray-500">{cards.length} cards</p>
        <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyCreditCardForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Credit Card
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Credit Card' : 'New Credit Card'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Holder (Partner)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.holder}
                  onChange={(e) => setForm({ ...form, holder: e.target.value, label: '' })}
                  required
                >
                  <option value="">Select</option>
                  {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bank</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value, label: '' })} placeholder="HDFC" required />
                </div>
                <div>
                  <Label>Network</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.network}
                    onChange={(e) => setForm({ ...form, network: e.target.value as (typeof CARD_NETWORKS)[number], label: '' })}
                  >
                    {CARD_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Last 4 digits (optional)</Label>
                <Input value={form.last_four} onChange={(e) => setForm({ ...form, last_four: e.target.value.replace(/\D/g, '').slice(0, 4), label: '' })} placeholder="4821" maxLength={4} />
              </div>
              <div>
                <Label>Display label</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={previewLabel(form) || 'Auto-generated from bank + network + holder'}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active (show in expense forms)
              </label>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Card</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        <button
          onClick={() => setFilterHolder('')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterHolder === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All
        </button>
        {JM_PARTNERS.map((p) => (
          <button
            key={p}
            onClick={() => setFilterHolder(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterHolder === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {p}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Last 4</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-gray-500">No credit cards</TableCell></TableRow>
              ) : filtered.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium">{card.label}</TableCell>
                  <TableCell>{card.holder}</TableCell>
                  <TableCell>{card.bank_name}</TableCell>
                  <TableCell>{card.network}</TableCell>
                  <TableCell>{card.last_four || <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell>
                    {card.is_active ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-600">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(card)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(card)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const typeColors: Record<ExpenseType, string> = {
  vehicle: 'bg-blue-100 text-blue-800',
  operational: 'bg-green-100 text-green-800',
  personal: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

const emptyCategoryForm = {
  name: '',
  expense_type: 'operational' as ExpenseType,
  sort_order: '0',
};

// ─── Categories Section ───
function CategoriesSection() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ExpenseType | ''>('');
  const [form, setForm] = useState(emptyCategoryForm);

  async function fetchCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name, expense_type, sort_order')
      .order('expense_type')
      .order('sort_order')
      .order('name');

    if (error) {
      if (error.message.includes('expense_categories') || error.message.includes('schema cache')) {
        toast.error('Categories table not found. Run supabase/expense_categories.sql in Supabase SQL Editor.');
      } else {
        toast.error(error.message);
      }
      setCategories([]);
    } else {
      setCategories((data as ExpenseCategory[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);

  const filtered = filterType
    ? categories.filter((c) => c.expense_type === filterType)
    : categories;

  const typeLabel = (type: ExpenseType) =>
    EXPENSE_TYPES.find((t) => t.value === type)?.label ?? type;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      expense_type: form.expense_type,
      sort_order: Number(form.sort_order) || 0,
    };
    if (!payload.name) {
      toast.error('Category name is required');
      return;
    }

    if (editingId) {
      const { error } = await supabase.from('expense_categories').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Category updated');
    } else {
      const { error } = await supabase.from('expense_categories').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Category added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyCategoryForm);
    fetchCategories();
  }

  function startEdit(c: ExpenseCategory) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      expense_type: c.expense_type,
      sort_order: String(c.sort_order),
    });
    setDialogOpen(true);
  }

  async function handleDelete(c: ExpenseCategory) {
    const { count } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('category', c.name);

    if (count && count > 0) {
      toast.error(`Cannot delete "${c.name}" — ${count} expense(s) use this category`);
      return;
    }
    if (!confirm(`Delete category "${c.name}"?`)) return;

    const { error } = await supabase.from('expense_categories').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Category deleted');
    fetchCategories();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-gray-500">{categories.length} categories</p>
        <Button size="sm" onClick={() => {
          setEditingId(null);
          setForm(emptyCategoryForm);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Expense Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.expense_type}
                  onChange={(e) => setForm({ ...form, expense_type: e.target.value as ExpenseType })}
                >
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Category</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All
        </button>
        {EXPENSE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setFilterType('other')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'other' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Other
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Order</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500">No categories</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[c.expense_type]}`}>
                      {typeLabel(c.expense_type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{c.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Admin Page ───
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('routes');

  const tabs: { value: Tab; label: string; icon: any }[] = [
    { value: 'routes', label: 'Routes', icon: RouteIcon },
    { value: 'drivers', label: 'Drivers', icon: Users },
    { value: 'partners', label: 'Partners', icon: Handshake },
    { value: 'categories', label: 'Categories', icon: Tags },
    { value: 'credit_cards', label: 'Credit Cards', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" />

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'routes' && <RoutesSection />}
      {tab === 'drivers' && <DriversSection />}
      {tab === 'partners' && <PartnersSection />}
      {tab === 'categories' && <CategoriesSection />}
      {tab === 'credit_cards' && <CreditCardsSection />}
    </div>
  );
}
