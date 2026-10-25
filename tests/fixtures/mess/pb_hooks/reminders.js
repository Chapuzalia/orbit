function sync(app, event, deleted) {
  const jobs = app.findRecordsByFilter('notification_jobs', 'source_type = "personal_agenda_event" && source_id = {:id} && (status = "pending" || status = "processing")', '', 0, 0, { id: event.id });
  jobs.forEach((job) => { job.set('status', 'cancelled'); app.save(job); });
  if (deleted || event.getBool('completed') || !event.getString('reminder_at')) return;
  const key = 'agenda_reminder:' + event.id + ':' + event.getString('reminder_at');
  const existing = app.findRecordsByFilter('notification_jobs', 'idempotency_key = {:key}', '', 1, 0, { key });
  const job = existing.length ? existing[0] : new Record(app.findCollectionByNameOrId('notification_jobs'));
  // Editing a delivered reminder must not send it a second time.
  if (job.getString('status') === 'sent') return;
  job.set('user_id', event.getString('user_id'));
  job.set('type', 'agenda_reminder');
  job.set('url', '/dashboard/agenda?event=' + event.id);
  job.set('payload', { event_id: event.id });
  job.set('source_type', 'personal_agenda_event');
  job.set('source_id', event.id);
  job.set('idempotency_key', key);
  job.set('scheduled_at', event.getString('reminder_at'));
  job.set('status', 'pending');
  job.set('attempts', 0);
  job.set('last_error', '');
  app.save(job);
}
function persistAndSync(e, deleted) {
  const originalApp = e.app;
  try {
    originalApp.runInTransaction((app) => {
      e.app = app;
      e.next();
      sync(app, e.record, deleted);
    });
  } finally { e.app = originalApp; }
}
module.exports = { sync, persistAndSync };
