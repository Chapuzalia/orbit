migrate((app) => {
  const clients = app.findCollectionByNameOrId('clients');
  clients.fields.add(new SelectField({ name: 'billing_cycle', maxSelect: 1, values: ['none', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'one_time'] }));
  clients.fields.add(new NumberField({ name: 'billing_amount', min: 0, max: 999999999.99 }));
  app.save(clients);
}, (app) => {
  const clients = app.findCollectionByNameOrId('clients');
  clients.fields.removeByName('billing_cycle');
  clients.fields.removeByName('billing_amount');
  app.save(clients);
});
