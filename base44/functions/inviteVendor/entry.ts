import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return Response.json({ error: 'Forbidden: Only admins and managers can invite users.' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required.' }, { status: 400 });
    }

    // Managers can only invite vendors (user role)
    const allowedRole = user.role === 'manager' ? 'user' : (role || 'user');

    // Use service role to bypass the admin-only restriction on inviteUser
    const invitedUser = await base44.asServiceRole.users.inviteUser(email, allowedRole === 'manager' ? 'user' : allowedRole);

    // If inviting as manager, update role after invitation
    if (allowedRole === 'manager' && invitedUser?.id) {
      await base44.asServiceRole.entities.User.update(invitedUser.id, { role: 'manager' });
    }

    return Response.json({ success: true, user: invitedUser });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});