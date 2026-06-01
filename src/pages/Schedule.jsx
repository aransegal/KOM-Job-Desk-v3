import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, Plus, Send, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, startOfWeek, format, parseISO } from 'date-fns';

function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [dialog, setDialog] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', customer_id: '', vendor_id: '', scheduled_date: '', scheduled_time: '' });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-scheduled_date', 200) });
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: () => base44.entities.WeeklySchedule.list() });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const weekJobs = jobs.filter(j => j.scheduled_date >= weekStartStr && j.scheduled_date <= weekEndStr && !j.is_on_demand);

  const createJobMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job added to schedule'); setDialog(false); },
  });

  const sendScheduleMutation = useMutation({
    mutationFn: async () => {
      const vendorIds = [...new Set(weekJobs.map(j => j.vendor_id))];
      for (const vendorId of vendorIds) {
        const existing = schedules.find(s => s.vendor_id === vendorId && s.week_start_date === weekStartStr);
        const sentAt = new Date().toISOString();
        if (existing) {
          await base44.entities.WeeklySchedule.update(existing.id, { status: 'sent', sent_at: sentAt });
        } else {
          await base44.entities.WeeklySchedule.create({ vendor_id: vendorId, week_start_date: weekStartStr, status: 'sent', sent_at: sentAt });
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success(`Schedule sent to ${[...new Set(weekJobs.map(j => j.vendor_id))].length} vendor(s)!`); },
  });

  const activeVendors = vendors.filter(v => v.status === 'active');

  const handleAddJob = (e) => {
    e.preventDefault();
    const data = { ...form, week_start_date: weekStartStr };
    createJobMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Weekly Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Build and send schedules to vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-3 min-w-48 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button
            onClick={() => sendScheduleMutation.mutate()}
            disabled={weekJobs.length === 0 || sendScheduleMutation.isPending}
            style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
            className="text-white border-0 ml-2"
          >
            <Send className="h-4 w-4 mr-2" />Send Schedule
          </Button>
        </div>
      </div>

      {/* Vendor rows */}
      <div className="space-y-4">
        {activeVendors.map(vendor => {
          const vendorWeekJobs = weekJobs.filter(j => j.vendor_id === vendor.id);
          const schedule = schedules.find(s => s.vendor_id === vendor.id && s.week_start_date === weekStartStr);

          return (
            <div key={vendor.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                       style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
                    {vendor.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{vendor.name}</p>
                    <p className="text-xs text-muted-foreground">{vendor.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {schedule && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      schedule.status === 'approved' ? 'bg-green-100 text-green-700' :
                      schedule.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{schedule.status}</span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setSelectedVendorId(vendor.id); setForm(f => ({ ...f, vendor_id: vendor.id, scheduled_date: format(weekDays[0], 'yyyy-MM-dd') })); setDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Job
                  </Button>
                </div>
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 border-b border-border">
                {weekDays.map((day, i) => (
                  <div key={i} className={`px-2 py-1.5 text-center border-r border-border last:border-r-0 ${
                    format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-primary/5' : ''
                  }`}>
                    <p className="text-xs font-medium text-muted-foreground">{DAYS[i]}</p>
                    <p className="text-xs text-foreground">{format(day, 'd')}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {weekDays.map((day, i) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayJobs = vendorWeekJobs.filter(j => j.scheduled_date === dayStr);
                  return (
                    <div key={i} className="border-r border-border last:border-r-0 p-2 min-h-16">
                      {dayJobs.map(job => (
                        <div
                          key={job.id}
                          className="text-xs p-1.5 rounded mb-1 cursor-pointer hover:opacity-80 transition-opacity text-white"
                          style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                        >
                          <p className="font-medium truncate">{job.title}</p>
                          {customerMap[job.customer_id] && <p className="opacity-80 truncate">{customerMap[job.customer_id].name}</p>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {vendorWeekJobs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No jobs scheduled this week</p>
              )}
            </div>
          );
        })}
        {activeVendors.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No active vendors. Add vendors first.</p>
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={() => setDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Job to Schedule</DialogTitle></DialogHeader>
          <form onSubmit={handleAddJob} className="space-y-4">
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
                <SelectContent>{activeVendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date *</Label><Input type="date" min={weekStartStr} max={weekEndStr} value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} required /></div>
              <div><Label>Time</Label><Input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">Add Job</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}