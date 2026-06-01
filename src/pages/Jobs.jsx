import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useCurrentVendor } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Search, Calendar, Zap, Filter } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = { title: '', description: '', customer_id: '', vendor_id: '', scheduled_date: '', scheduled_time: '', is_on_demand: false, week_start_date: '' };

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

export default function Jobs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: myVendor } = useCurrentVendor(user?.id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date', 200),
  });

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]));
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job created'); setDialog(false); },
  });

  // Role-based filter
  const myJobs = isAdminOrManager ? allJobs : allJobs.filter(j => j.vendor_id === myVendor?.id);

  const filtered = myJobs.filter(j =>
    (statusFilter === 'all' || j.status === statusFilter) &&
    (j.title?.toLowerCase().includes(search.toLowerCase()) ||
     customerMap[j.customer_id]?.name?.toLowerCase().includes(search.toLowerCase()) ||
     vendorMap[j.vendor_id]?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.scheduled_date) data.week_start_date = getMonday(data.scheduled_date);
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} jobs</p>
        </div>
        {isAdminOrManager && (
          <Button onClick={() => { setForm(EMPTY_FORM); setDialog(true); }} style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">
            <Plus className="h-4 w-4 mr-2" /> New Job
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['scheduled','approved','disapproved','in_progress','completed','declined'].map(s => (
              <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Job</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Customer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden lg:table-cell">Vendor</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, i) => (
                <tr
                  key={job.id}
                  className={`border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {job.is_on_demand && <Zap className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-foreground">{job.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">{customerMap[job.customer_id]?.name || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">{vendorMap[job.vendor_id]?.name || '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{job.scheduled_date}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No jobs found.</p>}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={() => setDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New Job</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vendor *</Label>
              <Select value={form.vendor_id} onValueChange={v => setForm(f => ({ ...f, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.filter(v => v.status === 'active').map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date *</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} required /></div>
              <div><Label>Time</Label><Input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="on_demand" checked={form.is_on_demand} onChange={e => setForm(f => ({ ...f, is_on_demand: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <Label htmlFor="on_demand">On-Demand Request</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">Create Job</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}