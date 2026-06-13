'use client';

import { useEffect, useState } from 'react';
import { supabase, Trip } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyTrip = {
  date: new Date().toISOString().split('T')[0],
  vehicle_number: '',
  route_name: '',
  driver_name: '',
  weight_tons: 0,
  distance_km: 0,
  rate_per_ton: 0,
  total_revenue: 0,
  advance_paid: 0,
  balance_due: 0,
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [routes, setRoutes] = useState<{ route_name: string; distance_km: number; standard_rate_per_ton: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTrip);

  async function fetchTrips() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('date', { ascending: false });
    setTrips(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTrips();
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: any) => v.vehicle_number));
    });
    supabase.from('drivers').select('name').order('name').then(({ data }) => {
      setDrivers((data || []).map((d: any) => d.name));
    });
    supabase.from('routes').select('route_name, distance_km, standard_rate_per_ton').then(({ data }) => {
      setRoutes(data || []);
    });
  }, []);

  function handleRouteChange(routeName: string) {
    const route = routes.find((r) => r.route_name === routeName);
    setForm((f) => ({
      ...f,
      route_name: routeName,
      distance_km: route ? Number(route.distance_km) : f.distance_km,
      rate_per_ton: route ? Number(route.standard_rate_per_ton) : f.rate_per_ton,
      total_revenue: f.weight_tons * (route ? Number(route.standard_rate_per_ton) : f.rate_per_ton),
    }));
  }

  function recalcRevenue(weight: number, rate: number) {
    setForm((f) => ({ ...f, weight_tons: weight, rate_per_ton: rate, total_revenue: weight * rate }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase.from('trips').update(form).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip updated');
    } else {
      const { error } = await supabase.from('trips').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyTrip);
    fetchTrips();
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setForm({
      date: trip.date,
      vehicle_number: trip.vehicle_number,
      route_name: trip.route_name,
      driver_name: trip.driver_name,
      weight_tons: Number(trip.weight_tons),
      distance_km: Number(trip.distance_km),
      rate_per_ton: Number(trip.rate_per_ton),
      total_revenue: Number(trip.total_revenue),
      advance_paid: Number(trip.advance_paid),
      balance_due: Number(trip.balance_due),
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this trip?')) return;
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Trip deleted');
    fetchTrips();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trip Log</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Trip</Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyTrip); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Trip' : 'New Trip'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <Label>Vehicle</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} required>
                    <option value="">Select</option>
                    {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Route</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.route_name} onChange={(e) => handleRouteChange(e.target.value)} required>
                    <option value="">Select</option>
                    {routes.map((r) => <option key={r.route_name} value={r.route_name}>{r.route_name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Driver</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} required>
                    <option value="">Select</option>
                    {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Weight (Tons)</Label>
                  <Input type="number" step="0.01" value={form.weight_tons || ''} onChange={(e) => recalcRevenue(Number(e.target.value), form.rate_per_ton)} required />
                </div>
                <div>
                  <Label>Distance (KM)</Label>
                  <Input type="number" value={form.distance_km || ''} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} required />
                </div>
                <div>
                  <Label>Rate/Ton</Label>
                  <Input type="number" step="0.01" value={form.rate_per_ton || ''} onChange={(e) => recalcRevenue(form.weight_tons, Number(e.target.value))} required />
                </div>
                <div>
                  <Label>Total Revenue</Label>
                  <Input type="number" step="0.01" value={form.total_revenue || ''} onChange={(e) => setForm({ ...form, total_revenue: Number(e.target.value) })} required />
                </div>
                <div>
                  <Label>Advance Paid</Label>
                  <Input type="number" step="0.01" value={form.advance_paid || ''} onChange={(e) => setForm({ ...form, advance_paid: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Balance Due</Label>
                  <Input type="number" step="0.01" value={form.balance_due || ''} onChange={(e) => setForm({ ...form, balance_due: Number(e.target.value) })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Trip</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Rate/Ton</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">No trips found</TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>{formatDate(trip.date)}</TableCell>
                      <TableCell><Badge variant="outline">{trip.vehicle_number}</Badge></TableCell>
                      <TableCell>{trip.route_name}</TableCell>
                      <TableCell>{trip.driver_name}</TableCell>
                      <TableCell className="text-right">{Number(trip.weight_tons).toFixed(2)} T</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(trip.rate_per_ton))}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(trip.total_revenue))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(trip)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(trip.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
