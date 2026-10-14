'use client';

import { useEffect, useState } from 'react';
import { supabase, type Route } from '@/lib/supabase';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';

const emptyRoute = { origin: '', destination: '', route_name: '', distance_km: 0, standard_rate_per_ton: 0, commission: 0 };

export function RoutesManager() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyRoute);

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalRoutes,
    setTotalItems: setTotalRoutes,
    totalPages,
  } = useServerPagination();

  async function fetchRoutes() {
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

  useEffect(() => { fetchRoutes(); }, [page, pageSize]);

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
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyRoute);
    fetchRoutes();
  }

  function startEdit(r: Route) {
    setEditingId(r.id);
    setForm({
      origin: r.origin,
      destination: r.destination,
      route_name: r.route_name,
      distance_km: Number(r.distance_km),
      standard_rate_per_ton: Number(r.standard_rate_per_ton),
      commission: Number(r.commission) || 0,
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this route? This will fail if trips reference it.')) return;
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Route deleted');
    fetchRoutes();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{totalRoutes} routes</p>
        <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyRoute); setDialogOpen(true); }}>
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
                <div>
                  <Label>Commission ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.commission || ''} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) })} />
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
                <TableHead className="text-right">Commission</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : routes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-gray-500">No routes</TableCell></TableRow>
              ) : routes.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.route_name}</TableCell>
                  <TableCell>{r.origin}</TableCell>
                  <TableCell>{r.destination}</TableCell>
                  <TableCell className="text-right">{Number(r.distance_km)} km</TableCell>
                  <TableCell className="text-right">{'\u20B9'}{Number(r.standard_rate_per_ton)}</TableCell>
                  <TableCell className="text-right">{'\u20B9'}{Number(r.commission) || 0}</TableCell>
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
