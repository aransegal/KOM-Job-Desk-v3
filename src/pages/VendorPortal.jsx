import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useCurrentVendor } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Check, Zap, MapPin, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, startOfWeek, format } from 'date-fns';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function VendorPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: myVendor, isLoading: loadingVendor } = useCurrentVendor(user?.id);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [disapproveDialog, setDisapproveDialog] = useState(null);
  const [disapproveReason, setDisapproveReason] = useState('');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const { data: myJobs = [] } = useQuery({
    queryKey: ['vendorJobs', myVendor?.id],
    queryFn: () => base44.entities.Job.filter({ vendor_id: myVendor.id }, '-scheduled_date', 100),
    enabled: !!myVendor?.id,
  });

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => base44.entities.WeeklySchedule.list(),
  });

  const weekJobs = myJobs.filter(j => j.scheduled_date >= weekStartStr && j.scheduled_date <= weekEndStr && !j.is_on_demand);
  const onDemandPending = myJobs.filter(j => j.is_on_demand && j.status === 'scheduled');
  const currentSchedule = schedules.find(s => s.vendor_id === myVendor?.id && s.week_start_date === weekStartStr);
  const canApprove = currentSchedule?.status === 'sent' || weekJobs.some(j => j.status === 'scheduled');

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorJobs', myVendor?.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const toApprove = weekJobs.filter(j => j.status === 'scheduled');
      await Promise.all(toApprove.map(j => base44.entities.Job.update(j.id, { status: 'approved' })));
      if (currentSchedule) await base44.entities.WeeklySchedule.update(currentSchedule.id, { status: 'approved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorJobs', myVendor?.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('All jobs approved!');
    },
  });

  const handleDisapprove = () => {
    if (!disapproveDialog) return;
    updateJobMutation.mutate({ id: disapproveDialog.id, data: { status: 'disapproved', disapproval_reason: disapproveReason } });
    setDisapproveDialog(null);
    setDisapproveReason('');
    toast.info('Job disapproved');
  };

  const handleOnDemand = (job, accept) => {
    updateJobMutation.mutate({ id: job.id, data: { status: accept ? 'approved' : 'declined' } });
    toast(accept ? 'Job accepted!' : 'Job declined', { icon: accept ? '✅' : '❌' });
  };

  if (loadingVendor) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;

  if (!myVendor) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="bg-white rounded-xl border border-border shadow-sm p-10 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Account not linked</h2>
        <p className="text-muted-foreground text-sm">Your account is not linked to a vendor profile. Please contact your administrator.</p>
        <p className="text-xs text-muted-foreground mt-2">Your User ID: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">{user?.id}</code></p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome, {myVendor.name} · {myVendor.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-44 text-center">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* On-demand requests */}
      {onDemandPending.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm p-5">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-purple-500" />On-Demand Requests ({onDemandPending.length})
          </h3>
          <div className="space-y-2">
            {onDemandPending.map(job => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-purple-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{job.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{job.scheduled_date} {job.scheduled_time && `at ${job.scheduled_time}`}
                  </p>
                  {customerMap[job.customer_id] && <p className="text-xs text-muted-foreground">{customerMap[job.customer_id].name}</p>}
                  {job.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{job.description}</p>}
                </div>
                <div className="flex gap-2 ml-3">
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleOnDemand(job, true)}>
                    <Check className="h-3.5 w-3.5 mr-1" />Accept
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleOnDemand(job, false)}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly calendar */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Week Overview</h3>
          {canApprove && (
            <Button
              size="sm"
              style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
              className="text-white border-0"
              onClick={() => approveAllMutation.mutate()}
              disabled={approveAllMutation.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((day, i) => (
            <div key={i} className={`p-3 text-center border-r border-border last:border-r-0 ${
              format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-primary/5' : ''
            }`}>
              <p className="text-xs font-semibold text-muted-foreground">{DAYS[i]}</p>
              <p className="text-sm font-bold text-foreground">{format(day, 'd')}</p>
              <p className="text-xs text-muted-foreground">{format(day, 'MMM')}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayJobs = weekJobs.filter(j => j.scheduled_date === dayStr);
            return (
              <div key={i} className="border-r border-border last:border-r-0 p-2 min-h-24">
                {dayJobs.map(job => (
                  <div key={job.id} className="mb-2 rounded-lg border overflow-hidden"
                    style={{ borderColor: job.status === 'approved' ? '#3CB371' : job.status === 'disapproved' ? '#F97316' : '#D1FAE5' }}>
                    <div className="p-2 text-xs" style={{ background: job.status === 'approved' ? '#f0fdf4' : job.status === 'disapproved' ? '#fff7ed' : '#f9fafb' }}>
                      <p className="font-medium text-foreground truncate">{job.title}</p>
                      {customerMap[job.customer_id] && <p className="text-muted-foreground truncate">{customerMap[job.customer_id].name}</p>}
                      {job.scheduled_time && <p className="text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{job.scheduled_time}</p>}
                      <div className="flex gap-1 mt-1.5">
                        {(job.status === 'approved' || job.status === 'in_progress') && (
                          <Button size="sm" className="h-5 text-xs px-2 bg-primary text-white" onClick={() => navigate(`/vendor-job/${job.id}`)}>
                            {job.status === 'in_progress' ? 'Continue' : 'Start'}
                          </Button>
                        )}
                        {job.status === 'scheduled' && (
                          <>
                            <button className="text-green-600 hover:text-green-700" title="Approve" onClick={() => updateJobMutation.mutate({ id: job.id, data: { status: 'approved' } })}>
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button className="text-orange-500 hover:text-orange-600" title="Disapprove" onClick={() => setDisapproveDialog(job)}>
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {job.status === 'completed' && <span className="text-green-600 text-xs font-medium">✓ Done</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {weekJobs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No jobs scheduled for this week.</p>}
      </div>

      {/* Disapprove dialog */}
      <Dialog open={!!disapproveDialog} onOpenChange={() => setDisapproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Disapprove Job</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{disapproveDialog?.title}</p>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={disapproveReason} onChange={e => setDisapproveReason(e.target.value)} placeholder="Why can't you do this job?" rows={3} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDisapproveDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisapprove}>Disapprove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}