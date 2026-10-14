'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { APP_PAGES } from '@/lib/auth/pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { formatMultiFilterLabel } from '@/lib/filter-helpers';
import { splitQueryList, useFilterQuery } from '@/hooks/use-filter-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type AppUser = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role_id: number;
  role: string;
  driver_id: number | null;
  driver_name: string | null;
  is_active: boolean;
};

type AppRole = {
  id: number;
  name: string;
  pages: string[];
};

type AuditRow = {
  id: number;
  user_name: string;
  action: string;
  screen: string;
  summary: string;
  created_at: string;
};

const emptyUser = {
  id: null as number | null,
  name: '',
  username: '',
  email: '',
  password: '',
  roleId: '',
  driverId: '',
  isActive: true,
};

export function UsersSection() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [userRes, roleRes] = await Promise.all([
      fetch('/api/users', { credentials: 'include' }),
      fetch('/api/roles', { credentials: 'include' }),
    ]);
    if (!userRes.ok) {
      const body = await userRes.json().catch(() => ({}));
      toast.error(body.error || 'Could not load users');
      return;
    }
    setUsers(await userRes.json());
    if (roleRes.ok) setRoles(await roleRes.json());
    const { data } = await supabase.from('drivers').select('id, name').order('name');
    setDrivers(data || []);
  }

  useEffect(() => { void load(); }, []);

  const selectedRole = roles.find((role) => String(role.id) === form.roleId);

  function startAdd() {
    setForm({ ...emptyUser, roleId: roles[0] ? String(roles[0].id) : '' });
    setOpen(true);
  }

  function startEdit(user: AppUser) {
    setForm({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email || '',
      password: '',
      roleId: String(user.role_id),
      driverId: user.driver_id ? String(user.driver_id) : '',
      isActive: user.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
          roleId: Number(form.roleId),
          driverId: selectedRole?.name === 'Driver' && form.driverId ? Number(form.driverId) : null,
          isActive: form.isActive,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error || 'Could not save user');
        return;
      }
      toast.success(form.id ? 'User updated' : 'User created');
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={startAdd}><Plus className="h-4 w-4 mr-1" /> Add user</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.driver_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(user)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit user' : 'Add user'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{form.id ? 'New password (leave blank to keep)' : 'Password'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </div>
            <div>
              <Label>Role</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </div>
            {selectedRole?.name === 'Driver' && (
              <div>
                <Label>Linked driver</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
                  <option value="">Select driver</option>
                  {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RolesSection() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: null as number | null, name: '', pages: [] as string[] });
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch('/api/roles', { credentials: 'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error || 'Could not load roles');
      return;
    }
    const rows = await response.json() as AppRole[];
    setRoles(rows.map((role) => ({ ...role, pages: Array.isArray(role.pages) ? role.pages : [] })));
  }

  useEffect(() => { void load(); }, []);

  function togglePage(key: string) {
    setForm((current) => ({
      ...current,
      pages: current.pages.includes(key) ? current.pages.filter((page) => page !== key) : [...current.pages, key],
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error || 'Could not save role');
        return;
      }
      toast.success(form.id ? 'Role updated. The person must sign in again to pick up new pages.' : 'Role created');
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm({ id: null, name: '', pages: [] }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add role
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>{role.name}</TableCell>
                  <TableCell className="whitespace-normal">{role.pages.join(', ') || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { setForm({ id: role.id, name: role.name, pages: role.pages }); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit role' : 'Add role'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {APP_PAGES.map((page) => (
                <label key={page.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.pages.includes(page.key)} onChange={() => togglePage(page.key)} />
                  {page.label}
                </label>
              ))}
            </div>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AUDIT_ACTIONS = ['add', 'edit', 'delete'];

export function AuditSection() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [showFilters, setShowFilters] = useState(() => Boolean(
    searchParams.get('from') || searchParams.get('dateTo') || searchParams.get('who')
    || searchParams.get('action') || searchParams.get('screen') || searchParams.get('q'),
  ));
  const [filterDateFrom, setFilterDateFrom] = useState(() => searchParams.get('from') || '');
  const [filterDateTo, setFilterDateTo] = useState(() => searchParams.get('dateTo') || '');
  const [filterWho, setFilterWho] = useState<string[]>(() => splitQueryList(searchParams.get('who')));
  const [filterActions, setFilterActions] = useState<string[]>(() => splitQueryList(searchParams.get('action')));
  const [filterScreens, setFilterScreens] = useState<string[]>(() => splitQueryList(searchParams.get('screen')));
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const searchQuery = useDebouncedValue(searchInput);

  useFilterQuery([
    { key: 'from', value: filterDateFrom },
    { key: 'dateTo', value: filterDateTo },
    { key: 'who', value: filterWho },
    { key: 'action', value: filterActions },
    { key: 'screen', value: filterScreens },
    { key: 'q', value: searchQuery },
  ]);

  useEffect(() => {
    fetch('/api/audit', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          toast.error(body.error || 'Could not load the audit log');
          return [];
        }
        return response.json();
      })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Could not load the audit log'));
  }, []);

  const people = useMemo(
    () => [...new Set(rows.map((row) => row.user_name).filter(Boolean))].sort(),
    [rows],
  );
  const screens = useMemo(
    () => [...new Set(['Expenses', 'Capital', 'Trip Log', 'Users', 'Roles', ...rows.map((row) => row.screen)])].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const when = new Date(row.created_at).getTime();
      if (filterDateFrom && when < new Date(`${filterDateFrom}T00:00:00`).getTime()) return false;
      if (filterDateTo && when > new Date(`${filterDateTo}T23:59:59.999`).getTime()) return false;
      if (filterWho.length > 0 && !filterWho.includes(row.user_name)) return false;
      if (filterActions.length > 0 && !filterActions.includes(row.action)) return false;
      if (filterScreens.length > 0 && !filterScreens.includes(row.screen)) return false;
      if (query && !`${row.summary} ${row.user_name} ${row.screen} ${row.action}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, filterDateFrom, filterDateTo, filterWho, filterActions, filterScreens, searchQuery]);

  const activeLabels = [
    filterDateFrom ? `From: ${filterDateFrom}` : '',
    filterDateTo ? `To: ${filterDateTo}` : '',
    formatMultiFilterLabel('Who', filterWho),
    formatMultiFilterLabel('Action', filterActions),
    formatMultiFilterLabel('Screen', filterScreens),
    searchQuery ? `Search: ${searchQuery}` : '',
  ].filter((label): label is string => Boolean(label));

  function clearFilters() {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterWho([]);
    setFilterActions([]);
    setFilterScreens([]);
    setSearchInput('');
  }

  return (
    <div className="space-y-4">
      <ActiveFiltersBar labels={activeLabels} onClear={clearFilters} />
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Advanced Filters
          {activeLabels.length > 0 && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">Active</span>}
        </button>
        {showFilters && (
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Date From</label>
                  <Input className="min-w-0" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Date To</label>
                  <Input className="min-w-0" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                </div>
                <MultiSelectFilter
                  label="Who"
                  options={people}
                  selected={filterWho}
                  onChange={setFilterWho}
                  placeholder="Everyone"
                  searchPlaceholder="Search person..."
                />
                <MultiSelectFilter
                  label="Action"
                  options={AUDIT_ACTIONS}
                  selected={filterActions}
                  onChange={setFilterActions}
                  placeholder="All actions"
                />
                <MultiSelectFilter
                  label="Screen"
                  options={screens}
                  selected={filterScreens}
                  onChange={setFilterScreens}
                  placeholder="All screens"
                  searchPlaceholder="Search screen..."
                />
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Search</label>
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Card, amount, summary..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Screen</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-gray-500">
                    {rows.length === 0 ? 'No activity recorded yet.' : 'No activity matches these filters.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.created_at).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{row.user_name}</TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.screen}</TableCell>
                  <TableCell className="whitespace-normal">{row.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
