migrate((app) => {
  const staff = '@request.auth.collectionName = "users" && @request.auth.id != ""';
  const scoped = staff + ' && organization_id != "" && organization_id = @request.auth.organization_id';
  const salesReps = new Collection({
    type: 'base', name: 'sales_reps',
    fields: [
      { type: 'relation', name: 'organization_id', collectionId: app.findCollectionByNameOrId('organizations').id, required: true, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'name', required: true, max: 200 },
      { type: 'email', name: 'email' },
      { type: 'text', name: 'phone', max: 100 },
      { type: 'text', name: 'notes', max: 5000 },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    listRule: scoped, viewRule: scoped, createRule: scoped,
    updateRule: scoped + ' && @request.body.organization_id:changed = false', deleteRule: scoped,
  });
  app.save(salesReps);
  const clients = app.findCollectionByNameOrId('clients');
  // A single optional relation is the source of truth for both sides.
  // Deleting a sales rep clears the assignment without deleting clients.
  clients.fields.add(new RelationField({ name: 'sales_rep_id', collectionId: salesReps.id, maxSelect: 1, required: false, cascadeDelete: false }));
  clients.indexes.push('CREATE INDEX idx_clients_sales_rep ON clients (sales_rep_id)');
  app.save(clients);
}, (app) => {
  const clients = app.findCollectionByNameOrId('clients');
  clients.fields.removeByName('sales_rep_id');
  clients.indexes = clients.indexes.filter((index) => !index.includes('idx_clients_sales_rep'));
  app.save(clients);
  app.delete(app.findCollectionByNameOrId('sales_reps'));
});
