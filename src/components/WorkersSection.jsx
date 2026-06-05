import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Users, Plus, X } from 'lucide-react';

const EMPTY_FORM = { name: '', email: '', phone: '', role: '', status: 'active' };

export default function WorkersSection({ vendorId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: workers = [] } = useQuery({
    queryKey: ['workers', vendorId],
    queryFn: () => base44.entities.Worker.filter({ vendor_id: vendorId }),
    enabled: !!vendorId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Worker.create({ ...data, vendor_id: vendorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers', vendorId] });
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Worker.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workers', vendorId] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Workers ({workers.length})
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />Add Worker</>}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-secondary/30 rounded-lg space-y-3 border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role / Trade</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Technician"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="worker@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Worker'}
            </Button>
          </div>
        </form>
      )}

      {workers.length === 0 && !showForm && (
        <p className="text-muted-foreground text-sm text-center py-6">No workers added yet.</p>
      )}

      <div className="space-y-2">
        {workers.map(worker => (
          <div key={worker.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{worker.name}</p>
              <p className="text-xs text-muted-foreground">
                {[worker.role, worker.email, worker.phone].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${worker.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {worker.status}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2"
                onClick={() => toggleMutation.mutate({ id: worker.id, status: worker.status === 'active' ? 'inactive' : 'active' })}
                disabled={toggleMutation.isPending}
              >
                {worker.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}