import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { ArrowLeft, Phone, Mail, MapPin, Briefcase, Calendar } from 'lucide-react';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => base44.entities.Customer.get(id),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', id],
    queryFn: () => base44.entities.Job.filter({ customer_id: id }, '-scheduled_date', 100),
    enabled: !!id,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]));

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;
  if (!customer) return <div className="text-center py-12 text-muted-foreground">Customer not found.</div>;

  const completed = jobs.filter(j => j.status === 'completed').length;
  const ongoing = jobs.filter(j => ['scheduled','approved','in_progress'].includes(j.status)).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-semibold text-foreground">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold mx-auto"
               style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
            {customer.name?.[0]?.toUpperCase()}
          </div>
          <h2 className="text-center font-semibold text-foreground text-lg">{customer.name}</h2>
          <div className="space-y-2 border-t border-border pt-4">
            {customer.phone && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{customer.phone}</p>}
            {customer.email && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />{customer.email}</p>}
            {(customer.address || customer.city) && (
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="text-center"><p className="text-2xl font-bold text-foreground">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-foreground">{ongoing}</p><p className="text-xs text-muted-foreground">Ongoing</p></div>
          </div>
          {customer.notes && <p className="text-xs text-muted-foreground border-t border-border pt-3">{customer.notes}</p>}
        </div>

        {/* Job history */}
        <div className="md:col-span-2 bg-white rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />Job History ({jobs.length})
          </h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {jobs.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No jobs for this customer yet.</p>}
            {jobs.map(job => (
              <div
                key={job.id}
                className="p-4 rounded-lg border border-border hover:bg-secondary/40 cursor-pointer transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />{job.scheduled_date}
                      {job.scheduled_time && ` at ${job.scheduled_time}`}
                    </p>
                    {vendorMap[job.vendor_id] && (
                      <p className="text-xs text-muted-foreground mt-0.5">Vendor: {vendorMap[job.vendor_id].name}</p>
                    )}
                    {job.completion_notes && (
                      <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 rounded p-2 line-clamp-2">{job.completion_notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={job.status} />
                    {job.is_on_demand && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">On-Demand</span>}
                  </div>
                </div>
                {(job.before_photos?.length > 0 || job.after_photos?.length > 0) && (
                  <div className="flex gap-2 mt-3">
                    {job.before_photos?.slice(0,2).map((p, i) => (
                      <img key={i} src={p} alt="before" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ))}
                    {job.after_photos?.slice(0,2).map((p, i) => (
                      <img key={i} src={p} alt="after" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}