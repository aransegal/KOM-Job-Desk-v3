import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import StatusBadge from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Briefcase, Users, HardHat, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CHART_COLORS = { scheduled: '#3B82F6', approved: '#3CB371', disapproved: '#F97316', in_progress: '#EAB308', completed: '#1AA260', declined: '#EF4444' };

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') navigate('/vendor-portal');
  }, [user, navigate]);

  // Real-time job notifications for admin/manager
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;
    const unsub = base44.entities.Job.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (event.type === 'update') {
        if (event.data?.status === 'in_progress') toast.info(`Vendor started job: ${event.data.title}`);
        if (event.data?.status === 'completed') toast.success(`Job completed: ${event.data.title}`);
      }
    });
    return unsub;
  }, [user, queryClient]);

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-scheduled_date', 100) });
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const todayJobs = jobs.filter(j => j.scheduled_date === today);
  const pendingApprovals = jobs.filter(j => j.status === 'scheduled' && !j.is_on_demand);
  const activeJobs = jobs.filter(j => j.status === 'in_progress');
  const activeVendors = vendors.filter(v => v.status === 'active');

  const statusCounts = jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});
  const chartData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  const recentJobs = [...jobs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 8);

  const stats = [
    { label: "Today's Jobs", value: todayJobs.length, icon: Briefcase, color: '#3CB371' },
    { label: 'Pending Approval', value: pendingApprovals.length, icon: Clock, color: '#EAB308' },
    { label: 'In Progress', value: activeJobs.length, icon: AlertCircle, color: '#F97316' },
    { label: 'Active Vendors', value: activeVendors.length, icon: HardHat, color: '#1AA260' },
    { label: 'Total Customers', value: customers.length, icon: Users, color: '#3B82F6' },
    { label: 'Completed (All)', value: jobs.filter(j => j.status === 'completed').length, icon: CheckCircle2, color: '#10B981' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, {user?.full_name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent jobs - full width */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Recent Jobs</h2>
        <div className="space-y-2">
          {recentJobs.length === 0 && <p className="text-muted-foreground text-sm">No jobs yet.</p>}
          {recentJobs.map(job => (
            <div
              key={job.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.scheduled_date}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Jobs by status chart - bottom */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Jobs by Status</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="status" tick={{ fontSize: 11 }} tickFormatter={s => s.replace('_', ' ')} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n, p) => [v, p.payload.status]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={CHART_COLORS[entry.status] || '#3CB371'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}