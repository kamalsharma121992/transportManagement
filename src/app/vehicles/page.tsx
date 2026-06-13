'use client';

import { useEffect, useState } from 'react';
import { supabase, Vehicle } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Truck, Car } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  vehicle_number: '',
  vehicle_type: 'Truck',
  model: '',
  capacity_tons: 0,
  chassis_number: '',
  insurance_expiry: '',
  permit_expiry: '',
  puc_expiry: '',
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [banking, setBanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function fetchVehicles() {
    const [{ data: veh }, { data: bank }] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('banking_information').select('*'),
    ]);
    setVehicles(veh || []);
    setBanking(bank || []);
    setLoading(false);
  }

  useEffect(() => { fetchVehicles(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      capacity_tons: form.capacity_tons || null,
      insurance_expiry: form.insurance_expiry || null,
      permit_expiry: form.permit_expiry || null,
      puc_expiry: form.puc_expiry || null,
    };
    if (editingId) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Vehicle updated');
    } else {
      const { error } = await supabase.from('vehicles').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Vehicle added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchVehicles();
  }

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm({
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      model: v.model || '',
      capacity_tons: Number(v.capacity_tons) || 0,
      chassis_number: v.chassis_number || '',
      insurance_expiry: v.insurance_expiry || '',
      permit_expiry: v.permit_expiry || '',
      puc_expiry: v.puc_expiry || '',
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this vehicle? This will fail if trips/expenses reference it.')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Vehicle deleted');
    fetchVehicles();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Vehicle</Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Vehicle' : 'New Vehicle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehicle Number</Label>
                  <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="RJ07GD6596" required disabled={!!editingId} />
                </div>
                <div>
                  <Label>Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                    <option value="Truck">Truck</option>
                    <option value="Personal Car">Personal Car</option>
                  </select>
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </div>
                <div>
                  <Label>Capacity (Tons)</Label>
                  <Input type="number" step="0.01" value={form.capacity_tons || ''} onChange={(e) => setForm({ ...form, capacity_tons: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Insurance Expiry</Label>
                  <Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} />
                </div>
                <div>
                  <Label>Permit Expiry</Label>
                  <Input type="date" value={form.permit_expiry} onChange={(e) => setForm({ ...form, permit_expiry: e.target.value })} />
                </div>
                <div>
                  <Label>PUC Expiry</Label>
                  <Input type="date" value={form.puc_expiry} onChange={(e) => setForm({ ...form, puc_expiry: e.target.value })} />
                </div>
                <div>
                  <Label>Chassis Number</Label>
                  <Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Vehicle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8">Loading...</div>
        ) : vehicles.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">No vehicles found</div>
        ) : (
          vehicles.map((v) => {
            const loans = banking.filter((b: any) => b.vehicle_number === v.vehicle_number);
            return (
              <Card key={v.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {v.vehicle_type === 'Truck' ? <Truck className="h-5 w-5 text-blue-600" /> : <Car className="h-5 w-5 text-green-600" />}
                      <CardTitle className="text-lg">{v.vehicle_number}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <Badge variant="outline">{v.vehicle_type}</Badge>
                  </div>
                  {v.model && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Model</span>
                      <span>{v.model}</span>
                    </div>
                  )}
                  {v.capacity_tons && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capacity</span>
                      <span>{Number(v.capacity_tons)} Tons</span>
                    </div>
                  )}
                  {loans.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-gray-500 mb-1">Loan Info</p>
                      {loans.map((loan: any, i: number) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>Bank: {loan.bank_name}</span>
                            {loan.monthly_emi && <span>EMI: {formatCurrency(Number(loan.monthly_emi))}</span>}
                          </div>
                          {loan.loan_amount && <div>Loan: {formatCurrency(Number(loan.loan_amount))}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
