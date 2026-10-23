migrate((app) => {
  const scoped = '@request.auth.collectionName = "users" && @request.auth.id != "" && organization_id != "" && organization_id = @request.auth.organization_id';
  app.save(new Collection({
    type: 'base', name: 'expenses',
    fields: [
      { type: 'relation', name: 'organization_id', collectionId: app.findCollectionByNameOrId('organizations').id, maxSelect: 1, required: true, cascadeDelete: true },
      { type: 'text', name: 'name', required: true, max: 200 },
      { type: 'text', name: 'supplier', max: 200 },
      { type: 'select', name: 'category', required: true, maxSelect: 1, values: ['software', 'infrastructure', 'services', 'marketing', 'office', 'taxes', 'other'] },
      { type: 'number', name: 'net_amount', min: 0, max: 999999999.99 },
      { type: 'select', name: 'vat_type', required: true, maxSelect: 1, values: ['rate', 'exempt', 'not_subject', 'reverse_charge'] },
      { type: 'number', name: 'vat_rate', min: 0, max: 100 },
      { type: 'select', name: 'billing_cycle', required: true, maxSelect: 1, values: ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'one_time'] },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'paused'] },
      { type: 'date', name: 'charge_date' },
      { type: 'text', name: 'notes', max: 5000 },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    listRule: scoped, viewRule: scoped, createRule: scoped,
    updateRule: scoped + ' && @request.body.organization_id:changed = false', deleteRule: scoped,
    indexes: ['CREATE INDEX idx_expenses_org_status ON expenses (organization_id, status)'],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId('expenses'));
});
