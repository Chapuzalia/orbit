routerAdd('POST', '/api/orbit/servers', (e) => {
  if (!e.hasSuperuserAuth() && e.auth.collection().name !== 'users') throw new ForbiddenError();
  const data = e.requestInfo().body;
  const organizationId = e.hasSuperuserAuth() ? data.organization_id : e.auth.getString('organization_id');
  if (!organizationId || data.organization_id !== organizationId) throw new ForbiddenError('Workspace invalido.');
  const name = String(data.name || '').trim();
  if (!name || name.length > 200) throw new BadRequestError('Nombre invalido.');
  const token = String(data.agent_token || '');
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(token)) throw new BadRequestError('Token invalido. Usa al menos 24 caracteres.');
  const server = new Record(e.app.findCollectionByNameOrId('servers'));
  server.set('organization_id', organizationId);
  server.set('name', name);
  ['provider', 'ip', 'location', 'os'].forEach((key) => server.set(key, String(data[key] || '')));
  ['domains', 'services'].forEach((key) => {
    if (!Array.isArray(data[key]) || data[key].some((value) => typeof value !== 'string')) throw new BadRequestError('Lista invalida.');
    server.set(key, data[key]);
  });
  server.set('status', 'offline');
  server.set('agent_token_hash', $security.hs256(token, organizationId));
  e.app.save(server);
  return e.json(201, server);
}, $apis.requireAuth('users', '_superusers'));

routerAdd('POST', '/api/orbit/server-metrics', (e) => {
  const data = e.requestInfo().body;
  const token = e.request.header.get('Authorization').replace(/^Bearer\s+/i, '');
  let server;
  try { server = e.app.findRecordById('servers', String(data.server_id || '')); } catch (_) { throw new UnauthorizedError('Token o servidor invalido.'); }
  const hash = server.getString('agent_token_hash');
  let valid = false;
  if (/^\$2[aby]\$/.test(hash)) {
    // Restored Supabase agents retain their bcrypt token hashes.
    const verifier = new Record(e.app.findCollectionByNameOrId('users'));
    verifier.setRaw('password', verifier.collection().fields.getByName('password').prepareValue(verifier, hash));
    valid = verifier.validatePassword(token);
  } else if (hash) {
    valid = $security.equal($security.hs256(token, server.getString('organization_id')), hash);
  }
  if (!token || !valid) throw new UnauthorizedError('Token o servidor invalido.');
  ['cpu', 'ram', 'disk'].forEach((key) => {
    if (!Number.isInteger(data[key]) || data[key] < 0 || data[key] > 100) throw new BadRequestError('Porcentaje invalido.');
  });
  ['load','latency'].forEach((key) => {
    if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0)) throw new BadRequestError('Metrica invalida.');
  });
  const max = Math.max(data.cpu, data.ram, data.disk);
  const status = max >= 90 ? 'critical' : max >= 75 ? 'warning' : 'operational';
  let metric;
  e.app.runInTransaction((app) => {
    server = app.findRecordById('servers', server.id);
    metric = new Record(app.findCollectionByNameOrId('server_metrics'));
    metric.set('server_id', server.id);
    metric.set('organization_id', server.getString('organization_id'));
    ['cpu','ram','disk','load','latency'].forEach((key) => metric.set(key, data[key] || 0));
    metric.set('uptime', String(data.uptime || '').slice(0, 200));
    metric.set('status', status);
    app.save(metric);
    ['cpu','ram','disk','load','latency','uptime','status'].forEach((key) => server.set(key, metric.get(key)));
    server.set('last_check', metric.getString('checked_at'));
    app.save(server);
  });
  return e.json(200, metric);
}, $apis.bodyLimit(4096));

onRecordValidate((e) => {
  const organizationId = e.record.getString('organization_id');
  const name = e.record.collection().name;
  const relations = {
    clients: { sales_rep_id: 'sales_reps' },
    server_metrics: { server_id: 'servers' }, invoices: { client_id: 'clients' },
    payments: { client_id: 'clients', invoice_id: 'invoices' }, subscriptions: { client_id: 'clients' },
    notifications: { user_id: 'users' }, activity: { actor_id: 'users' },
    user_preferences: { user_id: 'users' }, credentials: { created_by: 'users' },
  }[name] || {};
  for (const [field, collection] of Object.entries(relations)) {
    const id = e.record.getString(field);
    if (id && e.app.findRecordById(collection, id).getString('organization_id') !== organizationId) throw new BadRequestError('La relacion debe pertenecer al mismo workspace.');
  }
  return e.next();
}, 'clients', 'server_metrics', 'invoices', 'payments', 'subscriptions', 'notifications', 'activity', 'user_preferences', 'credentials');
