import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/StatusBadge';
import { ArrowLeft, MapPin, Calendar, Clock, Camera, CheckCircle2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VendorJobAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [completionNotes, setCompletionNotes] = useState('');
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const beforeRef = useRef();
  const afterRef = useRef();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => base44.entities.Job.get(id),
  });

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const uploadPhotos = async (files) => {
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    return urls;
  };

  const handleCheckIn = async () => {
    setUploading(true);
    const urls = await uploadPhotos(beforePhotos);
    await updateMutation.mutateAsync({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      before_photos: [...(job.before_photos || []), ...urls],
    });
    setUploading(false);
    setBeforePhotos([]);
    toast.success('Checked in! Your manager has been notified.');
  };

  const handleComplete = async () => {
    if (!completionNotes.trim()) { toast.error('Please write a completion description.'); return; }
    setUploading(true);
    const urls = await uploadPhotos(afterPhotos);
    await updateMutation.mutateAsync({
      status: 'completed',
      completed_at: new Date().toISOString(),
      after_photos: [...(job.after_photos || []), ...urls],
      completion_notes: completionNotes,
    });
    setUploading(false);
    setAfterPhotos([]);
    toast.success('Job marked as complete! Great work!');
    navigate('/vendor-portal');
  };

  const handleFileSelect = (e, setPhotos) => {
    const files = Array.from(e.target.files);
    setPhotos(prev => [...prev, ...files]);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;
  if (!job) return <div className="text-center py-12 text-muted-foreground">Job not found.</div>;

  const customer = customerMap[job.customer_id];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-semibold text-foreground flex-1 truncate">{job.title}</h1>
        <StatusBadge status={job.status} />
      </div>

      {/* Job info card */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
        {customer && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{customer.name}</p>
              {customer.address && <p className="text-xs text-muted-foreground">{customer.address}{customer.city && `, ${customer.city}`}</p>}
              {customer.phone && <p className="text-xs text-primary">{customer.phone}</p>}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <p className="text-sm text-foreground">{job.scheduled_date} {job.scheduled_time && `at ${job.scheduled_time}`}</p>
        </div>
        {job.description && <p className="text-sm text-muted-foreground border-t border-border pt-3">{job.description}</p>}
      </div>

      {/* CHECK IN section */}
      {job.status === 'approved' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />Check In at Job Site
          </h3>
          <p className="text-sm text-muted-foreground">Upload photos of the job site before starting work.</p>

          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => beforeRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload before photos</p>
            <input ref={beforeRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileSelect(e, setBeforePhotos)} />
          </div>

          {beforePhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {beforePhotos.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="w-full aspect-square object-cover rounded-lg border border-border" />
              ))}
            </div>
          )}

          <Button
            className="w-full text-white border-0"
            style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
            onClick={handleCheckIn}
            disabled={uploading}
          >
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><MapPin className="h-4 w-4 mr-2" />I'm at the Job Site</>}
          </Button>
        </div>
      )}

      {/* Existing before photos */}
      {job.status === 'in_progress' && job.before_photos?.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Before Photos</h4>
          <div className="grid grid-cols-3 gap-2">
            {job.before_photos.map((p, i) => (
              <img key={i} src={p} alt="" className="w-full aspect-square object-cover rounded-lg border border-border cursor-pointer" onClick={() => window.open(p, '_blank')} />
            ))}
          </div>
        </div>
      )}

      {/* COMPLETE section */}
      {job.status === 'in_progress' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />Complete Job
          </h3>

          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => afterRef.current?.click()}
          >
            <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Upload after photos</p>
            <input ref={afterRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileSelect(e, setAfterPhotos)} />
          </div>

          {afterPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {afterPhotos.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="w-full aspect-square object-cover rounded-lg border border-border" />
              ))}
            </div>
          )}

          <div>
            <Label>Work Description * <span className="text-muted-foreground text-xs">({completionNotes.length}/1000)</span></Label>
            <Textarea
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value.slice(0, 1000))}
              placeholder="Describe the work you performed..."
              rows={4}
              className="mt-1"
            />
          </div>

          <Button
            className="w-full text-white border-0"
            style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}
            onClick={handleComplete}
            disabled={uploading || !completionNotes.trim()}
          >
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Mark Job as Complete</>}
          </Button>
        </div>
      )}

      {/* Completed view */}
      {job.status === 'completed' && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">Job Complete!</h3>
          <p className="text-sm text-muted-foreground">Completed {job.completed_at ? new Date(job.completed_at).toLocaleString() : ''}</p>
          {job.completion_notes && <p className="text-sm text-foreground mt-3 bg-secondary/50 rounded-lg p-3 text-left">{job.completion_notes}</p>}
          <Button variant="outline" className="mt-4" onClick={() => navigate('/vendor-portal')}>Back to Schedule</Button>
        </div>
      )}
    </div>
  );
}