// PocketBase 0.40.5: the reduced Orbit schema, without application records.
migrate((app) => {
  const text = (name, required = false, max = 0, extra = {}) => ({ type: 'text', name, required, max, ...extra });
  const number = (name, extra = {}) => ({ type: 'number', name, ...extra });
  const date = (name) => ({ type: 'date', name });
  const json = (name) => ({ type: 'json', name });
  const bool = (name) => ({ type: 'bool', name });
  const timestamps = () => [
    { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
    { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
  ];
  let users;
  try { users = app.findCollectionByNameOrId('users'); } catch (_) { users = new Collection({ type: 'auth', name: 'users' }); }
  if (app.countRecords(users.id) > 0) throw new Error('Instala Orbit en una instancia nueva y crea las cuentas despues del esquema.');
  users.fields.add(new SelectField({ name: 'role', required: true, values: ['admin', 'user'], maxSelect: 1 }));
  ['name', 'bio', 'phone', 'location', 'avatar_url'].forEach((name) => users.fields.add(new TextField({ name })));
  const staff = '@request.auth.collectionName = "users" && @request.auth.id != ""';
  users.listRule = staff + ' && id = @request.auth.id';
  users.viewRule = staff + ' && id = @request.auth.id';
  users.createRule = null;
  users.updateRule = staff + ' && id = @request.auth.id && @request.body.role:changed = false';
  users.deleteRule = null;
  users.manageRule = null;
  users.passwordAuth = { enabled: true, identityFields: ['email'] };
  app.save(users);
  const organization = new Collection({ type: 'base', name: 'organizations', fields: [text('name', true, 200), text('plan'), text('cif'), text('currency'), ...timestamps()] });
  app.save(organization);
  users.fields.add(new RelationField({ name: 'organization_id', collectionId: organization.id, maxSelect: 1 }));
  users.listRule = staff + ' && @request.auth.role = "admin" && organization_id = @request.auth.organization_id';
  users.updateRule += ' && @request.body.organization_id:changed = false';
  app.save(users);
  const ownOrganization = staff + ' && id = @request.auth.organization_id';
  organization.listRule = ownOrganization;
  organization.viewRule = ownOrganization;
  organization.createRule = null;
  organization.updateRule = ownOrganization + ' && @request.auth.role = "admin"';
  organization.deleteRule = null;
  app.save(organization);
  const relation = (name, collection, required = false, cascadeDelete = false) => ({ type: 'relation', name, collectionId: app.findCollectionByNameOrId(collection).id, required, cascadeDelete, maxSelect: 1 });
  const scoped = staff + ' && organization_id != "" && organization_id = @request.auth.organization_id';
  const immutableOrg = ' && @request.body.organization_id:changed = false';
  const save = (name, fields, overrides = {}, indexes = []) => {
    const collection = new Collection({ type: 'base', name,
      fields: [relation('organization_id', 'organizations', true, true), ...fields, ...timestamps()],
      listRule: scoped, viewRule: scoped, createRule: scoped, updateRule: scoped + immutableOrg, deleteRule: scoped,
      indexes, ...overrides,
    });
    app.save(collection);
    return collection;
  };
  save('clients', [text('name', true, 200), ...['legal_name', 'tax_id', 'contact', 'email', 'phone', 'address', 'status', 'type', 'color'].map((name) => text(name)), number('revenue'), number('pending'), date('last_contact')]);
  save('servers', [text('name', true, 200), ...['provider','ip','location','os','status','uptime','ssl'].map((name) => text(name)),
    text('agent_token_hash', false, 100, { hidden: true }), number('cpu', { min: 0, max: 100 }), number('ram', { min: 0, max: 100 }), number('disk', { min: 0, max: 100 }),
    number('load', { min: 0 }), number('latency', { min: 0 }), json('services'), number('docker'), json('domains'), date('ssl_expiry'), date('last_check'), number('incidents')],
    { createRule: null, updateRule: null });
  save('server_metrics', [relation('server_id', 'servers', true, true), number('cpu', { min: 0, max: 100 }), number('ram', { min: 0, max: 100 }), number('disk', { min: 0, max: 100 }),
    number('load', { min: 0 }), number('latency', { min: 0 }), text('uptime'), text('status'), { type: 'autodate', name: 'checked_at', onCreate: true, onUpdate: false }],
    { createRule: null, updateRule: null, deleteRule: null }, ['CREATE INDEX idx_server_checked ON server_metrics (server_id, checked_at)']);
  save('invoices', [text('number'), relation('client_id', 'clients'), number('amount'), text('status'), date('issued'), date('due'), text('concept')]);
  save('payments', [relation('invoice_id', 'invoices'), relation('client_id', 'clients'), number('amount'), text('method'), date('date'), text('status')]);
  save('subscriptions', [relation('client_id', 'clients'), text('plan', true), number('amount'), text('interval'), text('status'), date('started'), date('next_invoice')]);
  save('revenue_by_month', [text('month', true), number('ingresos'), number('recurrente'), number('sort_order')]);
  const personal = scoped + ' && (user_id = "" || user_id = @request.auth.id)';
  save('notifications', [relation('user_id', 'users', false, true), text('type'), text('title', true), text('body'), text('href'), bool('read')],
    { listRule: personal, viewRule: personal, createRule: null, updateRule: personal + ' && @request.body.user_id:changed = false && @request.body.organization_id:changed = false && @request.body.title:changed = false && @request.body.body:changed = false && @request.body.href:changed = false && @request.body.type:changed = false', deleteRule: personal });
  save('activity', [relation('actor_id', 'users'), text('type'), text('text', true), text('detail')], { createRule: null, updateRule: null, deleteRule: null });
  const owner = scoped + ' && user_id = @request.auth.id';
  save('user_preferences', [relation('user_id', 'users', true, true), json('notifications'), text('theme')],
    { listRule: owner, viewRule: owner, createRule: owner, updateRule: owner + immutableOrg + ' && @request.body.user_id:changed = false', deleteRule: owner },
    ['CREATE UNIQUE INDEX idx_preferences_user ON user_preferences (user_id)']);
  save('integrations', [text('name', true), text('description'), bool('connected')],
    { createRule: scoped + ' && @request.auth.role = "admin"', updateRule: scoped + immutableOrg + ' && @request.auth.role = "admin"', deleteRule: scoped + ' && @request.auth.role = "admin"' },
    ['CREATE UNIQUE INDEX idx_integrations_org_name ON integrations (organization_id, name)']);
  save('credentials', [relation('created_by', 'users'), text('name', true), ...['category','site','username','email','password','recovery','notes'].map((name) => text(name))]);
}, (app) => {
  ['credentials','integrations','user_preferences','activity','notifications','revenue_by_month','subscriptions','payments','invoices','server_metrics','servers','clients'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)));
  const users = app.findCollectionByNameOrId('users');
  ['organization_id','role','name','bio','phone','location','avatar_url'].forEach((name) => users.fields.removeByName(name));
  users.listRule = users.viewRule = users.updateRule = 'id = @request.auth.id';
  app.save(users);
  app.delete(app.findCollectionByNameOrId('organizations'));
});
