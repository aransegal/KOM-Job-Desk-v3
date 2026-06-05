import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday
 * of the week containing `dateStr`.
 */
function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Maps a Job status to a ScheduleItem schedule_status.
 */
function toScheduleStatus(jobStatus) {
  if (jobStatus === 'completed') return 'completed';
  if (jobStatus === 'declined' || jobStatus === 'disapproved') return 'cancelled';
  return 'scheduled';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Auth ---
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin';
    const isDispatcher = user.role === 'dispatcher' || user.role === 'manager';

    if (!isAdmin && !isDispatcher) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Parse input ---
    let body = {};
    try { body = await req.json(); } catch (_) { /* empty body ok */ }
    const dryRun = body.dryRun === true;

    // Dispatchers may only run dry-run
    if (!isAdmin && !dryRun) {
      return Response.json({ error: 'Forbidden: only admins can run the real backfill' }, { status: 403 });
    }

    // --- Load all records (service role for full access) ---
    const [jobs, existingAssignments, existingScheduleItems] = await Promise.all([
      base44.asServiceRole.entities.Job.list('-created_date', 1000),
      base44.asServiceRole.entities.JobAssignment.list('-created_date', 1000),
      base44.asServiceRole.entities.ScheduleItem.list('-created_date', 1000),
    ]);

    // Build lookup sets for idempotency
    const assignedJobIds = new Set(existingAssignments.map(a => a.job_id));
    const scheduledJobIds = new Set(existingScheduleItems.map(s => s.job_id));
    // job_id → assignment (need the id for ScheduleItem.assignment_id)
    const assignmentByJobId = Object.fromEntries(existingAssignments.map(a => [a.job_id, a]));

    // --- Counters ---
    const counts = {
      jobsScanned: jobs.length,
      assignmentsCreated: 0,
      scheduleItemsCreated: 0,
      skippedNoVendor: 0,
      skippedNoScheduledDate: 0,
      alreadyHadAssignment: 0,
      alreadyHadScheduleItem: 0,
      errors: [],
    };

    // Track newly created assignments within this run (for ScheduleItem.assignment_id)
    const newAssignmentByJobId = {};
    const now = new Date().toISOString();

    for (const job of jobs) {
      // --- A. JobAssignment backfill ---
      let assignment = assignmentByJobId[job.id] || null;

      if (assignedJobIds.has(job.id)) {
        counts.alreadyHadAssignment++;
      } else {
        if (!job.vendor_id) {
          counts.skippedNoVendor++;
          // Skip ScheduleItem too for this job
          continue;
        }

        if (!dryRun) {
          try {
            assignment = await base44.asServiceRole.entities.JobAssignment.create({
              job_id: job.id,
              vendor_id: job.vendor_id,
              worker_id: null,
              assigned_by_user_id: user.id,
              assignment_status: 'assigned',
              assigned_at: now,
              notes: 'Backfilled from existing Job',
            });
            newAssignmentByJobId[job.id] = assignment;
            counts.assignmentsCreated++;
          } catch (err) {
            counts.errors.push({ job_id: job.id, step: 'JobAssignment', error: err.message });
            continue;
          }
        } else {
          counts.assignmentsCreated++;
          // In dry-run we synthesise a placeholder so ScheduleItem counting can proceed
          assignment = { id: '__dry_run__', worker_id: null };
        }
      }

      // --- B. ScheduleItem backfill ---
      if (scheduledJobIds.has(job.id)) {
        counts.alreadyHadScheduleItem++;
        continue;
      }

      if (!job.scheduled_date) {
        counts.skippedNoScheduledDate++;
        continue;
      }

      const weekStart = job.week_start_date || getMondayOf(job.scheduled_date);
      const scheduleStatus = toScheduleStatus(job.status);
      const assignmentId = assignment?.id || null;
      const workerId = assignment?.worker_id || null;

      if (!dryRun) {
        try {
          await base44.asServiceRole.entities.ScheduleItem.create({
            job_id: job.id,
            assignment_id: assignmentId,
            vendor_id: job.vendor_id || null,
            worker_id: workerId,
            scheduled_date: job.scheduled_date,
            start_time: job.scheduled_time || null,
            week_start_date: weekStart,
            schedule_status: scheduleStatus,
            created_by_user_id: user.id,
            notes: 'Backfilled from existing Job',
          });
          counts.scheduleItemsCreated++;
        } catch (err) {
          counts.errors.push({ job_id: job.id, step: 'ScheduleItem', error: err.message });
        }
      } else {
        counts.scheduleItemsCreated++;
      }
    }

    // Rename fields for dry-run output to match spec
    if (dryRun) {
      return Response.json({
        dryRun: true,
        jobsScanned: counts.jobsScanned,
        assignmentsWouldCreate: counts.assignmentsCreated,
        scheduleItemsWouldCreate: counts.scheduleItemsCreated,
        skippedNoVendor: counts.skippedNoVendor,
        skippedNoScheduledDate: counts.skippedNoScheduledDate,
        alreadyHadAssignment: counts.alreadyHadAssignment,
        alreadyHadScheduleItem: counts.alreadyHadScheduleItem,
      });
    }

    return Response.json({
      dryRun: false,
      jobsScanned: counts.jobsScanned,
      assignmentsCreated: counts.assignmentsCreated,
      scheduleItemsCreated: counts.scheduleItemsCreated,
      skippedNoVendor: counts.skippedNoVendor,
      skippedNoScheduledDate: counts.skippedNoScheduledDate,
      alreadyHadAssignment: counts.alreadyHadAssignment,
      alreadyHadScheduleItem: counts.alreadyHadScheduleItem,
      errors: counts.errors,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});