migrate((app) => {
  const staff = '@request.auth.collectionName = "users" && @request.auth.id != ""';
  const scoped = staff + ' && organization_id != "" && organization_id = @request.auth.organization_id';
  const relation = (name, collection) => ({ type: 'relation', name, collectionId: app.findCollectionByNameOrId(collection).id, required: true, maxSelect: 1, cascadeDelete: false });
  app.save(new Collection({ type: 'base', name: 'sales_commissions', fields: [
    { ...relation('organization_id', 'organizations'), cascadeDelete: true }, relation('client_id', 'clients'), relation('sales_rep_id', 'sales_reps'),
    { type: 'select', name: 'plan', required: true, maxSelect: 1, values: ['basic', 'pro', 'business', 'custom'] },
    { type: 'number', name: 'monthly_amount', min: 0, max: 999999999.99 },
    { type: 'number', name: 'bonus_multiplier', min: 0, max: 10 }, { type: 'number', name: 'rate', min: 0, max: 100 },
    { type: 'number', name: 'first_month', required: true, min: 1, max: 120, onlyInt: true }, { type: 'number', name: 'last_month', required: true, min: 1, max: 120, onlyInt: true },
    { type: 'text', name: 'start_month', required: true, max: 7, pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'ended'] }, { type: 'number', name: 'ended_month', min: 0, max: 120, onlyInt: true },
    { type: 'json', name: 'receipts', maxSize: 20000 },
    { type: 'autodate', name: 'created', onCreate: true }, { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
  ], indexes: ['CREATE UNIQUE INDEX idx_commission_client_rep ON sales_commissions (client_id, sales_rep_id)'],
    listRule: scoped, viewRule: scoped, createRule: scoped,
    updateRule: scoped + ' && @request.body.organization_id:changed = false && @request.body.client_id:changed = false && @request.body.sales_rep_id:changed = false', deleteRule: null,
  }));
}, (app) => { app.delete(app.findCollectionByNameOrId('sales_commissions')); });
