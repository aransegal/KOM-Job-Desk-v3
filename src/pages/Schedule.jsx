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
import { ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, startOfWeek, format } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [dialog, setDialog] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', customer_id: '', vendor_id: '', scheduled_date: '', scheduled_time: '' });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-scheduled_date', 200) });
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: () => base44.entities.WeeklySchedule.list() });
  const { data: allWorkers = [] } = useQuery({ queryKey: ['workers'], queryFn: () => base44.entities.Worker.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['jobAssignments'], queryFn: () => base44.entities.JobAssignment.list() });

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const workerMap = Object.fromEntries(allWorkers.map((w) => [w.id, w]));
  // Map job_id -> worker_id via assignments (for display on cards)
  const jobWorkerMap = Object.fromEntries(assignments.filter(a => a.worker_id).map(a => [a.job_id, a.worker_id]));

  const weekJobs = jobs.filter((j) => j.scheduled_date >= weekStartStr && j.scheduled_date <= weekEndStr && !j.is_on_demand);

  // Active workers filtered to currently selected vendor in dialog (client-side filter for both status and vendor)
  const vendorActiveWorkers = allWorkers.filter(w => w.vendor_id === form.vendor_id && w.status === 'active');
  const resolvedWorkerId = (selectedWorkerId && selectedWorkerId !== '__none__') ? selectedWorkerId : null;

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Create the Job
      const job = await base44.entities.Job.create(data);

      // 2. Create JobAssignment
      let assignment;
      try {
        assignment = await base44.entities.JobAssignment.create({
          job_id: job.id,
          vendor_id: data.vendor_id,
          worker_id: resolvedWorkerId,
          assigned_by_user_id: currentUser?.id || null,
          assignment_status: 'assigned',
          assigned_at: new Date().toISOString(),
        });
      } catch (err) {
        toast.error(`Job created but JobAssignment failed: ${err.message}`);
        return job;
      }

      // 3. Create ScheduleItem
      try {
        await base44.entities.ScheduleItem.create({
          job_id: job.id,
          assignment_id: assignment.id,
          vendor_id: data.vendor_id,
          worker_id: resolvedWorkerId,
          scheduled_date: data.scheduled_date,
          start_time: data.scheduled_time || null,
          week_start_date: data.week_start_date,
          schedule_status: 'scheduled',
          created_by_user_id: currentUser?.id || null,
        });
      } catch (err) {
        toast.error(`Job created but ScheduleItem failed: ${err.message}`);
      }

      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobAssignments'] });
      toast.success('Job added to schedule');
      setDialog(false);
      setSelectedWorkerId('');
    },
  });

  const sendScheduleMutation = useMutation({
    mutationFn: async () => {
      const vendorIds = [...new Set(weekJobs.map((j) => j.vendor_id))];
      for (const vendorId of vendorIds) {
        const existing = schedules.find((s) => s.vendor_id === vendorId && s.week_start_date === weekStartStr);
        const sentAt = new Date().toISOString();
        if (existing) {
          await base44.entities.WeeklySchedule.update(existing.id, { status: 'sent', sent_at: sentAt });
        } else {
          await base44.entities.WeeklySchedule.create({ vendor_id: vendorId, week_start_date: weekStartStr, status: 'sent', sent_at: sentAt });
        }
      }
    },
    onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['schedules'] });toast.success(`Schedule sent to ${[...new Set(weekJobs.map((j) => j.vendor_id))].length} vendor(s)!`);}
  });

  const activeVendors = vendors.filter((v) => v.status === 'active');
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));

  const handleAddJob = (e) => {
    e.preventDefault();
    createJobMutation.mutate({ ...form, week_start_date: weekStartStr });
  };

  const handleVendorChange = (v) => {
    setForm(f => ({ ...f, vendor_id: v }));
    setSelectedWorkerId(''); // reset worker when vendor changes
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-left">Weekly Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Build and send schedules to vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-3 min-w-48 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((d) => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button
            onClick={() => sendScheduleMutation.mutate()}
            disabled={weekJobs.length === 0 || sendScheduleMutation.isPending}
            style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
            className="text-white border-0 ml-2">
            
            <Send className="h-4 w-4 mr-2" />Send Schedule
          </Button>
        </div>
      </div>

      {/* Day-based calendar grid */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header: day columns */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, i) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <div key={i} className={`px-3 py-3 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary/10' : 'bg-secondary/20'}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{DAYS[i]}</p>
                <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</p>
                <p className="text-xs text-muted-foreground">{format(day, 'MMM')}</p>
              </div>);

          })}
        </div>

        {/* Job cells per day */}
        <div className="grid grid-cols-7 min-h-64">
          {weekDays.map((day, i) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayJobs = weekJobs.filter((j) => j.scheduled_date === dayStr);
            const isToday = dayStr === format(new Date(), 'yyyy-MM-dd');
            return (
              <div key={i} className={`border-r border-border last:border-r-0 p-2 space-y-1.5 ${isToday ? 'bg-primary/5' : ''}`}>
                {dayJobs.map((job) => {
                  const vendor = vendorMap[job.vendor_id];
                  return (
                    <div
                      key={job.id}
                      className="p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity text-white text-xs"
                      style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
                      onClick={() => navigate(`/jobs/${job.id}`)}>
                      
                      <p className="font-semibold truncate leading-tight">{job.title}</p>
                      {vendor && <p className="opacity-80 truncate mt-0.5">👷 {vendor.name}</p>}
                      {jobWorkerMap[job.id] && workerMap[jobWorkerMap[job.id]] && (
                        <p className="opacity-80 truncate mt-0.5">🧑‍🔧 {workerMap[jobWorkerMap[job.id]].name}</p>
                      )}
                      {job.scheduled_time && <p className="opacity-70 mt-0.5">🕐 {job.scheduled_time}</p>}
                    </div>);

                })}
                {dayJobs.length === 0 &&
                <p className="text-xs text-muted-foreground text-center pt-4 opacity-50">—</p>
                }
              </div>);

          })}
        </div>
      </div>

      {/* Add job button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => {setForm((f) => ({ ...f, scheduled_date: weekStartStr }));setDialog(true);}}>
          <Plus className="h-4 w-4 mr-2" />Add Job
        </Button>
      </div>

      <Dialog open={dialog} onOpenChange={() => { setDialog(false); setSelectedWorkerId(''); setForm(f => ({ ...f, vendor_id: '', customer_id: '' })); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Job to Schedule</DialogTitle></DialogHeader>
          <form onSubmit={handleAddJob} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vendor *</Label>
              <Select value={form.vendor_id} onValueChange={handleVendorChange}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{activeVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.vendor_id && (
              <div>
                <Label>Worker (optional)</Label>
                <Select
                  value={selectedWorkerId || undefined}
                  onValueChange={(v) => setSelectedWorkerId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      vendorActiveWorkers.length === 0
                        ? 'No active workers for this vendor'
                        : 'Select worker (optional)'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No worker —</SelectItem>
                    {vendorActiveWorkers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}{w.role ? ` · ${w.role}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date *</Label><Input type="date" min={weekStartStr} max={weekEndStr} value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} required /></div>
              <div><Label>Time</Label><Input type="time" value={form.scheduled_time} onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">Add Job</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

}