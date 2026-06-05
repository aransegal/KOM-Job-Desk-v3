import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required.' }, { status: 400 });
    }

    // Resolve vendor by user_id only
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ user_id: user.id });
    const vendor = vendors[0];

    if (!vendor) {
      return Response.json({ error: 'Vendor profile is not linked to this user.' }, { status: 403 });
    }

    // Fetch the job
    const job = await base44.asServiceRole.entities.Job.get(job_id);

    if (!job) {
      return Response.json({ error: 'Job not found.' }, { status: 404 });
    }

    // Ownership check
    if (job.vendor_id !== vendor.id) {
      return Response.json({ error: 'Forbidden: This job does not belong to your vendor account.' }, { status: 403 });
    }

    // Fetch only the customer for this job
    let customer = null;
    if (job.customer_id) {
      const c = await base44.asServiceRole.entities.Customer.get(job.customer_id).catch(() => null);
      if (c) {
        customer = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
        };
      }
    }

    return Response.json({ vendor, job, customer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});