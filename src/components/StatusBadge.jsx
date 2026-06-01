const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  disapproved: { label: 'Disapproved', className: 'bg-orange-100 text-orange-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}