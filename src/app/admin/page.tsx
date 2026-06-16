'use client';

import { useEffect, useState } from 'react';
import { supabase, Route, Driver, Partner, JM_PARTNERS, PAID_BY_ENTITIES } from '@/lib/supabase';
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
import { Plus, Pencil, Trash2, Route as RouteIcon, Users, Handshake } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';

type Tab = 'routes' | 'drivers' | 'partners';

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
function DriversSection() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', phone: '' });

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
    const payload = { name: form.name, phone: form.phone || null };
    if (editingId) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Driver updated');
    } else {
      // Also add to partners so they appear in expense dropdowns
      const { error } = await supabase.from('drivers').insert(payload);
      if (error) { toast.error(error.message); return; }
      await supabase.from('partners').upsert({ name: form.name }, { onConflict: 'name' });
      toast.success('Driver added');
    }
    setDialogOpen(false); setEditingId(null);
    setForm({ name: '', phone: '' });
    fetch();
  }

  function startEdit(d: Driver) {
    setEditingId(d.id);
    setForm({ name: d.name, phone: d.phone || '' });
    setDialogOpen(true);
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
        <Button size="sm" onClick={() => { setEditingId(null); setForm({ name: '', phone: '' }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Driver
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-sm">
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
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Driver</Button>
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
                <TableHead>Phone</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : drivers.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500">No drivers</TableCell></TableRow>
              ) : drivers.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.phone || <span className="text-gray-300">-</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(d)}><Pencil className="h-4 w-4" /></Button>
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

// ─── Main Admin Page ───
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('routes');

  const tabs: { value: Tab; label: string; icon: any }[] = [
    { value: 'routes', label: 'Routes', icon: RouteIcon },
    { value: 'drivers', label: 'Drivers', icon: Users },
    { value: 'partners', label: 'Partners', icon: Handshake },
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
    </div>
  );
}
