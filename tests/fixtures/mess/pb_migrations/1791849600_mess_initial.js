// PocketBase 0.40.5. Schema only: no imported records or user accounts.
migrate((app) => {
  const staff = '@request.auth.collectionName = "users" && @request.auth.id != ""';
  const owner = staff + ' && user_id = @request.auth.id';
  const immutableOwner = ' && @request.body.user_id:changed = false';
  const text = (name, required = false, max = 0, pattern = '') => ({ type: 'text', name, required, max, pattern });
  const date = (name, required = false) => ({ type: 'date', name, required });
  const timestamps = () => [
    { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
    { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
  ];
  let users;
  try { users = app.findCollectionByNameOrId('users'); } catch (_) { users = new Collection({ type: 'auth', name: 'users' }); }
  if (app.countRecords(users.id) > 0) throw new Error('Esta migración requiere una base nueva, sin cuentas en users.');
  users.fields.add(new SelectField({ name: 'role', required: true, maxSelect: 1, values: ['admin', 'user'] }));
  users.listRule = staff + ' && @request.auth.role = "admin"';
  users.viewRule = staff + ' && (id = @request.auth.id || @request.auth.role = "admin")';
  users.createRule = null;
  users.updateRule = staff + ' && id = @request.auth.id && @request.body.role:changed = false';
  users.deleteRule = null;
  users.manageRule = null;
  users.passwordAuth = { enabled: true, identityFields: ['email'] };
  app.save(users);
  const userRelation = () => ({ type: 'relation', name: 'user_id', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 });
  const save = (name, fields, rules, indexes = []) => app.save(new Collection({ type: 'base', name, fields: fields.concat(timestamps()), indexes, ...rules }));

  ['customers', 'customers_test'].forEach((name) => save(name, [
    text('name', true, 200), { type: 'number', name: 'tel', required: true, onlyInt: true, min: 100000000, max: 999999999 },
    { type: 'number', name: 'points', onlyInt: true, min: 0 },
    { type: 'autodate', name: 'registered_at', onCreate: true, onUpdate: false }, date('last_Visit'),
  ], { listRule: staff, viewRule: staff, createRule: null,
    updateRule: staff + ' && @request.body.points:changed = false && @request.body.tel:changed = false && @request.body.registered_at:changed = false', deleteRule: staff },
  ['CREATE UNIQUE INDEX idx_' + name + '_tel ON ' + name + ' (tel)']));

  // Campaign delivery/history still lives in the existing BullMQ queues.
  ['campaigns', 'campaigns_test'].forEach((name) => save(name, [text('title', true, 200), text('message', true, 10000), text('link', false, 2000),
    { type: 'number', name: 'recipients_count', onlyInt: true, min: 0 },
    { type: 'select', name: 'status', values: ['pending', 'sent'], maxSelect: 1 },
  ], { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }));

  save('venue_reservations', [text('reservation_date', true, 10, '^\\d{4}-\\d{2}-\\d{2}$'),
    text('start_time', true, 8, '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$'), text('concept', true, 1000),
    text('contact_person', true, 200), text('contact_phone', true, 30), text('waiter_id', true, 200),
    { type: 'bool', name: 'needs_dj' }, { type: 'bool', name: 'deposit_paid' },
  ], { listRule: staff, viewRule: staff, createRule: staff, updateRule: staff, deleteRule: staff },
  ['CREATE INDEX idx_venue_date ON venue_reservations (reservation_date, start_time)']);

  save('personal_agenda_events', [userRelation(), text('title', true, 500), text('description', false, 10000),
    { type: 'select', name: 'event_type', required: true, values: ['event', 'reminder', 'task', 'meeting', 'note'], maxSelect: 1 },
    date('start_at', true), date('end_at'), { type: 'bool', name: 'all_day' }, text('color', true, 50), text('location', false, 500),
    date('reminder_at'), { type: 'bool', name: 'completed' },
  ], { listRule: owner, viewRule: owner, createRule: owner, updateRule: owner + immutableOwner, deleteRule: owner },
  ['CREATE INDEX idx_agenda_user_start ON personal_agenda_events (user_id, start_at)']);

  save('push_subscriptions', [userRelation(), { type: 'url', name: 'endpoint', required: true }, text('p256dh', true, 500),
    text('auth', true, 500), text('user_agent', false, 2000), text('device_name', false, 200), date('last_used_at'),
  ], { listRule: owner, viewRule: owner, createRule: null, updateRule: null, deleteRule: owner },
  ['CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint)', 'CREATE INDEX idx_push_user ON push_subscriptions (user_id)']);

  save('notification_jobs', [userRelation(), text('type', true, 100), text('title', false, 500), text('body', false, 10000),
    text('url', false, 2000), { type: 'json', name: 'payload' }, text('source_type', false, 100), text('source_id', false, 100),
    text('idempotency_key', true, 500), date('scheduled_at', true), date('sent_at'),
    { type: 'select', name: 'status', required: true, values: ['pending', 'processing', 'sent', 'failed', 'cancelled'], maxSelect: 1 },
    { type: 'number', name: 'attempts', onlyInt: true, min: 0 }, text('last_error', false, 2000),
  ], { listRule: owner, viewRule: owner, createRule: null, updateRule: null, deleteRule: null },
  ['CREATE UNIQUE INDEX idx_notification_key ON notification_jobs (idempotency_key)',
    'CREATE INDEX idx_notification_schedule ON notification_jobs (status, scheduled_at)',
    'CREATE INDEX idx_notification_source ON notification_jobs (source_type, source_id)']);
}, (app) => {
  ['notification_jobs', 'push_subscriptions', 'personal_agenda_events', 'venue_reservations', 'campaigns_test', 'campaigns', 'customers_test', 'customers'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)));
  const users = app.findCollectionByNameOrId('users');
  users.fields.removeByName('role');
  users.listRule = 'id = @request.auth.id';
  users.viewRule = 'id = @request.auth.id';
  users.updateRule = 'id = @request.auth.id';
  app.save(users);
});
