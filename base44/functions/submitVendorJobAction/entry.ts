import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ALLOWED_ACTIONS = [
  'approve_job',
  'disapprove_job',
  'accept_on_demand',
  'decline_on_demand',
  'check_in',
  'complete_job',
  'approve_all_week_jobs',
];

// Valid transitions: [currentStatus] -> [allowedNextStatus]
const TRANSITIONS = {
  approve_job:      { from: 'scheduled',   to: 'approved' },
  disapprove_job:   { from: 'scheduled',   to: 'disapproved' },
  accept_on_demand: { from: 'scheduled',   to: 'approved' },
  decline_on_demand:{ from: 'scheduled',   to: 'declined' },
  check_in:         { from: 'approved',    to: 'in_progress' },
  complete_job:     { from: 'in_progress', to: 'completed' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, job_id, disapproval_reason, before_photo_urls, after_photo_urls, completion_notes, week_start_date } = body;

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}` }, { status: 400 });
    }

    // Resolve vendor — server side only, no email fallback
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ user_id: user.id });
    const vendor = vendors[0];

    if (!vendor) {
      return Response.json({ error: 'Vendor profile is not linked to this user.' }, { status: 403 });
    }

    // ── approve_all_week_jobs ──────────────────────────────────────────────────
    if (action === 'approve_all_week_jobs') {
      if (!week_start_date) {
        return Response.json({ error: 'week_start_date is required for approve_all_week_jobs.' }, { status: 400 });
      }

      const weekEnd = (() => {
        const d = new Date(week_start_date);
        d.setDate(d.getDate() + 6);
        return d.toISOString().slice(0, 10);
      })();

      // Only this vendor's jobs in the week with status scheduled
      const vendorJobs = await base44.asServiceRole.entities.Job.filter({ vendor_id: vendor.id });
      const toApprove = vendorJobs.filter(
        j => !j.is_on_demand && j.status === 'scheduled' && j.scheduled_date >= week_start_date && j.scheduled_date <= weekEnd
      );

      await Promise.all(toApprove.map(j =>
        base44.asServiceRole.entities.Job.update(j.id, { status: 'approved' })
      ));

      // Update this vendor's WeeklySchedule for the week if it exists
      const schedules = await base44.asServiceRole.entities.WeeklySchedule.filter({ vendor_id: vendor.id, week_start_date });
      if (schedules[0]) {
        await base44.asServiceRole.entities.WeeklySchedule.update(schedules[0].id, { status: 'approved' });
      }

      return Response.json({ success: true, approved_count: toApprove.length });
    }

    // ── single-job actions ─────────────────────────────────────────────────────
    if (!job_id) {
      return Response.json({ error: 'job_id is required.' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found.' }, { status: 404 });
    }

    // Ownership check
    if (job.vendor_id !== vendor.id) {
      return Response.json({ error: 'Forbidden: This job does not belong to your vendor account.' }, { status: 403 });
    }

    const transition = TRANSITIONS[action];
    if (transition && job.status !== transition.from) {
      return Response.json({
        error: `Cannot perform '${action}' on a job with status '${job.status}'. Expected status: '${transition.from}'.`
      }, { status: 422 });
    }

    let updatePayload = {};

    if (action === 'approve_job' || action === 'accept_on_demand') {
      updatePayload = { status: 'approved' };
    } else if (action === 'disapprove_job') {
      updatePayload = { status: 'disapproved', disapproval_reason: disapproval_reason || '' };
    } else if (action === 'decline_on_demand') {
      updatePayload = { status: 'declined' };
    } else if (action === 'check_in') {
      updatePayload = {
        status: 'in_progress',
        started_at: new Date().toISOString(),
        before_photos: [...(job.before_photos || []), ...(before_photo_urls || [])],
      };
    } else if (action === 'complete_job') {
      if (!completion_notes || !completion_notes.trim()) {
        return Response.json({ error: 'completion_notes is required for complete_job.' }, { status: 400 });
      }
      updatePayload = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        after_photos: [...(job.after_photos || []), ...(after_photo_urls || [])],
        completion_notes: completion_notes.trim(),
      };
    }

    const updated = await base44.asServiceRole.entities.Job.update(job_id, updatePayload);
    return Response.json({ success: true, job: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});