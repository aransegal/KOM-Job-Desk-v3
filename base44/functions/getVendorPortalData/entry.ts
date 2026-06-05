import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { weekStart, weekEnd } = await req.json().catch(() => ({}));

    // Resolve vendor by user_id only — no email fallback
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ user_id: user.id });
    const vendor = vendors[0];

    if (!vendor) {
      return Response.json({ error: 'Vendor profile is not linked to this user.' }, { status: 403 });
    }

    // Load only this vendor's jobs
    const allJobs = await base44.asServiceRole.entities.Job.filter({ vendor_id: vendor.id });

    // Filter by week if provided
    const jobs = (weekStart && weekEnd)
      ? allJobs.filter(j => j.scheduled_date >= weekStart && j.scheduled_date <= weekEnd)
      : allJobs;

    // Load only this vendor's weekly schedules
    const allSchedules = await base44.asServiceRole.entities.WeeklySchedule.filter({ vendor_id: vendor.id });

    // Build a set of customer IDs referenced by this vendor's jobs
    const customerIds = [...new Set(allJobs.map(j => j.customer_id).filter(Boolean))];

    // Fetch only those customers and build a safe snapshot
    const customersById = {};
    await Promise.all(customerIds.map(async (cid) => {
      const c = await base44.asServiceRole.entities.Customer.get(cid).catch(() => null);
      if (c) {
        customersById[cid] = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
        };
      }
    }));

    return Response.json({ vendor, jobs: allJobs, customersById, schedules: allSchedules });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});