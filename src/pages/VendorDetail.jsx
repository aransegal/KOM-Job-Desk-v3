import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { ArrowLeft, Phone, Mail, HardHat, Calendar, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import WorkersSection from '@/components/WorkersSection';

const CATEGORY_COLORS = {
  'Construction Work': 'bg-orange-100 text-orange-700',
  'Water Tanks Installer': 'bg-blue-100 text-blue-700',
  'Chimney Cleaner': 'bg-gray-100 text-gray-700',
  'Air Ducts Cleaner': 'bg-cyan-100 text-cyan-700',
  'Electrician': 'bg-yellow-100 text-yellow-700',
  'Other': 'bg-purple-100 text-purple-700',
};

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => base44.entities.Vendor.get(id),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['vendorJobs', id],
    queryFn: () => base44.entities.Job.filter({ vendor_id: id }, '-scheduled_date', 50),
    enabled: !!id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;
  if (!vendor) return <div className="text-center py-12 text-muted-foreground">Vendor not found.</div>;

  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-semibold text-foreground">{vendor.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile card */}
        <div className="md:col-span-1 bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
            <HardHat className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold text-foreground text-lg">{vendor.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[vendor.category] || 'bg-gray-100 text-gray-700'}`}>
              {vendor.category}
            </span>
            {vendor.category === 'Other' && vendor.category_description && (
              <p className="text-xs text-muted-foreground mt-1">{vendor.category_description}</p>
            )}
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            {vendor.phone && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{vendor.phone}</p>}
            {vendor.email && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />{vendor.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{jobs.length}</p>
              <p className="text-xs text-muted-foreground">Total Jobs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{completedJobs.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
          <span className={`w-full flex justify-center text-xs px-2 py-1 rounded-full font-medium ${vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{vendor.status}</span>
          {vendor.notes && <p className="text-xs text-muted-foreground border-t border-border pt-3">{vendor.notes}</p>}
        </div>

        {/* Workers + Job history */}
        <div className="md:col-span-2 space-y-4">
        <WorkersSection vendorId={id} />
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Job History ({jobs.length})</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {jobs.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No jobs assigned yet.</p>}
            {jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/40 cursor-pointer transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {job.scheduled_date}
                    {customerMap[job.customer_id] && <> · {customerMap[job.customer_id].name}</>}
                    {job.is_on_demand && <span className="ml-1 bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">On-Demand</span>}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}