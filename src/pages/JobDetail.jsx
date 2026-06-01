import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { ArrowLeft, Calendar, Clock, User, MapPin, Zap, Camera, FileText } from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => base44.entities.Job.get(id),
  });

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]));
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', id] }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;
  if (!job) return <div className="text-center py-12 text-muted-foreground">Job not found.</div>;

  const vendor = vendorMap[job.vendor_id];
  const customer = customerMap[job.customer_id];
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const STATUS_TRANSITIONS = {
    scheduled: ['approved', 'disapproved', 'declined'],
    approved: ['in_progress', 'disapproved'],
    disapproved: ['scheduled'],
    in_progress: ['completed'],
    declined: ['scheduled'],
  };
  const nextStatuses = STATUS_TRANSITIONS[job.status] || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {job.is_on_demand && <Zap className="h-4 w-4 text-purple-500" />}
            <h1 className="text-2xl font-semibold text-foreground">{job.title}</h1>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Details */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Job Details</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{job.scheduled_date} {job.scheduled_time && `at ${job.scheduled_time}`}</p>
              </div>
            </div>
            {vendor && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Vendor</p>
                  <p className="text-sm font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/vendors/${job.vendor_id}`)}>{vendor.name}</p>
                  <p className="text-xs text-muted-foreground">{vendor.category}</p>
                </div>
              </div>
            )}
            {customer && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/customers/${job.customer_id}`)}>{customer.name}</p>
                  {customer.address && <p className="text-xs text-muted-foreground">{customer.address}{customer.city && `, ${customer.city}`}</p>}
                </div>
              </div>
            )}
            {job.started_at && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-sm">{new Date(job.started_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            {job.completed_at && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-sm">{new Date(job.completed_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
          {job.description && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{job.description}</p>
            </div>
          )}
          {job.disapproval_reason && (
            <div className="border-t border-border pt-4 bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-orange-600 font-medium mb-1">Disapproval Reason</p>
              <p className="text-sm text-orange-800">{job.disapproval_reason}</p>
            </div>
          )}

          {/* Admin status change */}
          {isAdminOrManager && nextStatuses.length > 0 && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Change Status</p>
              {nextStatuses.map(s => (
                <Button key={s} size="sm" variant="outline" className="w-full text-xs" onClick={() => updateMutation.mutate({ status: s })}>
                  Mark as {s.replace('_', ' ')}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Photos & notes */}
        <div className="md:col-span-2 space-y-4">
          {/* Before photos */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Camera className="h-4 w-4 text-primary" />Before Photos
            </h3>
            {job.before_photos?.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {job.before_photos.map((p, i) => (
                  <img key={i} src={p} alt={`before-${i}`} className="w-full aspect-square object-cover rounded-lg border border-border cursor-pointer" onClick={() => window.open(p, '_blank')} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No before photos yet.</p>}
          </div>

          {/* After photos */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Camera className="h-4 w-4 text-primary" />After Photos
            </h3>
            {job.after_photos?.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {job.after_photos.map((p, i) => (
                  <img key={i} src={p} alt={`after-${i}`} className="w-full aspect-square object-cover rounded-lg border border-border cursor-pointer" onClick={() => window.open(p, '_blank')} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No after photos yet.</p>}
          </div>

          {/* Completion notes */}
          {job.completion_notes && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />Completion Notes
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{job.completion_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}