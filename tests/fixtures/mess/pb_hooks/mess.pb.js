routerAdd('GET', '/api/mess/venue-availability', (e) => {
  const date = e.request.url.query().get('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new BadRequestError('Fecha inválida.');
  // Business dates follow Europe/Madrid, matching the application.
  const now = Date.now();
  const utcDate = new Date(now).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const nextMadridMidnight = new DateTime(tomorrow + ' 00:00:00', 'Europe/Madrid');
  const today = now >= Date.parse(nextMadridMidnight.string()) ? tomorrow : utcDate;
  const reservations = e.app.findRecordsByFilter('venue_reservations', 'reservation_date = {:date}', '', 1, 0, { date });
  return e.json(200, { available: date >= today && reservations.length === 0 });
});

routerAdd('POST', '/api/mess/member-points', (e) => {
  if (!e.hasSuperuserAuth() && e.auth.collection().name !== 'users') throw new ForbiddenError();
  const data = e.requestInfo().body;
  const collection = data.collection;
  if (collection !== 'customers' && collection !== 'customers_test') throw new BadRequestError('Colección inválida.');
  const amount = Number(data.amount);
  if (!/^\d{9}$/.test(String(data.phone)) || !Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 10000) throw new BadRequestError('Ajuste inválido.');
  let member;
  e.app.runInTransaction((app) => {
    const records = app.findRecordsByFilter(collection, 'tel = {:phone}', '', 1, 0, { phone: Number(data.phone) });
    if (!records.length) throw new NotFoundError('Socio no encontrado.');
    member = records[0];
    const points = member.getInt('points') + amount;
    if (points < 0) throw new ApiError(409, 'Puntos insuficientes.');
    member.set('points', points);
    app.save(member);
  });
  return e.json(200, member);
}, $apis.requireAuth());

routerAdd('POST', '/api/mess/claim-notifications', (e) => {
  let claimed = [];
  const now = new Date().toISOString().replace('T', ' ');
  const stale = new Date(Date.now() - 300000).toISOString().replace('T', ' ');
  e.app.runInTransaction((app) => {
    const abandoned = app.findRecordsByFilter('notification_jobs', 'status = "processing" && updated < {:stale}', '', 50, 0, { stale });
    abandoned.forEach((job) => { job.set('status', job.getInt('attempts') >= 3 ? 'failed' : 'pending'); app.save(job); });
    claimed = app.findRecordsByFilter('notification_jobs', 'status = "pending" && scheduled_at <= {:now} && attempts < 3', 'scheduled_at', 50, 0, { now });
    claimed.forEach((job) => { job.set('status', 'processing'); job.set('attempts', job.getInt('attempts') + 1); app.save(job); });
  });
  return e.json(200, claimed);
}, $apis.requireSuperuserAuth());

onRecordValidate((e) => {
  const title = e.record.getString('title').trim();
  if (!title) throw new BadRequestError('El título no puede estar vacío.');
  e.record.set('title', title);
  const end = e.record.getString('end_at');
  if (end && Date.parse(end) < Date.parse(e.record.getString('start_at'))) throw new BadRequestError('El final no puede ser anterior al inicio.');
  return e.next();
}, 'personal_agenda_events');

onRecordCreate((e) => {
  require(__hooks + '/reminders.js').persistAndSync(e, false);
}, 'personal_agenda_events');
onRecordUpdate((e) => {
  require(__hooks + '/reminders.js').persistAndSync(e, false);
}, 'personal_agenda_events');
onRecordDelete((e) => {
  require(__hooks + '/reminders.js').persistAndSync(e, true);
}, 'personal_agenda_events');
