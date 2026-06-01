import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Mail, Phone, MapPin, Save } from 'lucide-react';

export default function Profile() {
  const { data: user, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.auth.updateMe(form);
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    toast.success('Profile updated');
    setSaving(false);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">View and update your personal information</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{user?.full_name}</p>
            <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>

        {/* Read-only fields */}
        <div className="space-y-3">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5" />Full Name</Label>
            <Input value={user?.full_name || ''} disabled className="bg-muted/40" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
            <Input value={user?.email || ''} disabled className="bg-muted/40" />
          </div>
        </div>

        {/* Editable fields */}
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5" />Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Your phone number" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5"><MapPin className="h-3.5 w-3.5" />Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Your address" />
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }} className="text-white border-0">
              <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}