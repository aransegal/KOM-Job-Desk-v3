import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, HardHat, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Construction Work', 'Water Tanks Installer', 'Chimney Cleaner', 'Air Ducts Cleaner', 'Electrician', 'Other'];
const CATEGORY_COLORS = {
  'Construction Work': 'bg-orange-100 text-orange-700',
  'Water Tanks Installer': 'bg-blue-100 text-blue-700',
  'Chimney Cleaner': 'bg-gray-100 text-gray-700',
  'Air Ducts Cleaner': 'bg-cyan-100 text-cyan-700',
  'Electrician': 'bg-yellow-100 text-yellow-700',
  'Other': 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM = { name: '', email: '', phone: '', category: '', category_description: '', status: 'active', notes: '', user_id: '' };

export default function Vendors() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialog, setDialog] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const isAdmin = user?.role === 'admin';

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Vendor.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor created'); setDialog(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Vendor.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor updated'); setDialog(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Vendor.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor deleted'); setDeleteId(null); },
  });

  const filtered = vendors.filter(v =>
    (catFilter === 'all' || v.category === catFilter) &&
    (v.name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => { setForm(EMPTY_FORM); setDialog('create'); };
  const openEdit = (v) => { setForm({ name: v.name, email: v.email || '', phone: v.phone || '', category: v.category, category_description: v.category_description || '', status: v.status || 'active', notes: v.notes || '', user_id: v.user_id || '' }); setEditId(v.id); setDialog('edit'); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (dialog === 'create') createMutation.mutate(form);
    else updateMutation.mutate({ id: editId, data: form });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-1">{vendors.length} vendors registered</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">
            <Plus className="h-4 w-4 mr-2" /> New Vendor
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/vendors/${v.id}`)}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
                    <HardHat className="h-5 w-5 text-white" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{v.status}</span>
                </div>
                <h3 className="font-semibold text-foreground">{v.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${CATEGORY_COLORS[v.category] || 'bg-gray-100 text-gray-700'}`}>{v.category}</span>
                {v.category === 'Other' && v.category_description && <p className="text-xs text-muted-foreground mt-1">{v.category_description}</p>}
                <div className="mt-3 space-y-1">
                  {v.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{v.phone}</p>}
                  {v.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{v.email}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="px-5 py-3 border-t border-border flex gap-2" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(v)}><Edit className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No vendors found.</p>}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'New Vendor' : 'Edit Vendor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.category === 'Other' && <div><Label>Category Description</Label><Input value={form.category_description} onChange={e => setForm(f => ({ ...f, category_description: e.target.value }))} placeholder="Describe the service..." /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div><Label>Linked User ID</Label><Input value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} placeholder="User ID to link vendor account" /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">
                {dialog === 'create' ? 'Create' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Vendor?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}