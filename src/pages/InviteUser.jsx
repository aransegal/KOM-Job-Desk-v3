import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, CheckCircle2 } from 'lucide-react';

export default function InviteUser() {
  const { data: currentUser } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return <div className="p-8 text-center text-muted-foreground">Access denied.</div>;
  }

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      // Platform only supports 'user' or 'admin' as base platform roles
      const platformRole = role === 'admin' ? 'admin' : 'user';
      const invitedUser = await base44.auth.inviteUser(email, platformRole);

      // If the intended role is 'manager', update the app-level role after invitation
      if (role === 'manager' && invitedUser?.id) {
        await base44.entities.User.update(invitedUser.id, { role: 'manager' });
      }

      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Invite User</h1>
        <p className="text-muted-foreground text-sm mt-1">Send an invitation email to add a new team member.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Vendor</SelectItem>
                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && <SelectItem value="manager">Manager</SelectItem>}
                {currentUser?.role === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Invitation sent successfully!
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            <UserPlus className="h-4 w-4" />
            {loading ? 'Sending...' : 'Send Invite'}
          </Button>
        </form>
      </div>
    </div>
  );
}