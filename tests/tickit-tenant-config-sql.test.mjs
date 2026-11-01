import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { TickitPosService, readTickitConfig } from '../mcp/modules/tickit-pos/service.mjs'
import { tenantAddonKeys } from '../mcp/modules/tickit-pos/schema.mjs'
import { createSupabaseFixture, tickitEnv, ids } from './helpers/tickit-supabase.mjs'

test('actual tenant configuration SQL accepts MCP addons and rejects core keys atomically', { timeout: 30000 }, async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  // Minimal isolated tables used by the unmodified upstream function.
  await db.exec(`
    create table public.tenants (id uuid primary key, name text not null, slug text unique not null,
      max_venues integer not null, max_devices integer not null, updated_at timestamptz default now());
    create table public.venues (id uuid primary key, tenant_id uuid not null references public.tenants(id));
    create table public.devices (id uuid primary key, tenant_id uuid not null references public.tenants(id), is_active boolean not null);
    create table public.platform_features (key text primary key);
    create table public.tenant_feature_assignments (tenant_id uuid not null references public.tenants(id),
      feature_key text not null references public.platform_features(key), primary key(tenant_id,feature_key));
  `)
  await db.exec(await readFile(new URL('./fixtures/tickit-tenant-config.sql', import.meta.url), 'utf8'))
  await db.query('insert into public.tenants(id,name,slug,max_venues,max_devices) values($1,$2,$3,1,2),($4,$5,$6,1,2)', [ids.tenant, 'Before', 'before', ids.otherTenant, 'Other', 'other'])
  await db.query('insert into public.venues(id,tenant_id) values($1,$2)', [ids.venue, ids.tenant])
  await db.query('insert into public.devices(id,tenant_id,is_active) values($1,$2,true)', [ids.device, ids.tenant])
  for (const key of [...tenantAddonKeys, 'discounts', 'inventory_recipes', 'supplier_documents', 'supplier_document_scanning', 'multi_device']) {
    await db.query('insert into public.platform_features(key) values($1)', [key])
  }
  await db.query('insert into public.tenant_feature_assignments(tenant_id,feature_key) values($1,$3),($2,$3)', [ids.tenant, ids.otherTenant, 'promotions'])
  const features = async () => (await db.query('select feature_key from public.tenant_feature_assignments where tenant_id=$1 order by feature_key', [ids.tenant])).rows.map((row) => row.feature_key)
  const run = (body) => db.query('select * from public.update_platform_tenant_config($1::uuid,$2::text,$3::text,$4::integer,$5::integer,$6::text[])',
    [body.p_tenant_id, body.p_name, body.p_slug, body.p_max_venues, body.p_max_devices, body.p_feature_keys])
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), { fetchImpl: async (url, options) => {
    if (new URL(url).pathname.endsWith('/update_platform_tenant_config')) {
      const result = await run(JSON.parse(options.body))
      return new Response(JSON.stringify(result.rows), { headers: { 'Content-Type': 'application/json' } })
    }
    return fixture.fetchImpl(url, options)
  } })
  const input = { tenant_id: ids.tenant, name: 'Pro example', slug: 'pro-example', max_venues: 1, max_devices: 2, feature_keys: ['restaurant', 'analytics_advanced'], confirm: true }
  assert.equal((await service.configureTenant(input)).id, ids.tenant)
  assert.deepEqual(await features(), ['analytics_advanced', 'restaurant'])
  assert.deepEqual((await db.query('select name,max_venues,max_devices from public.tenants where id=$1', [ids.tenant])).rows[0], { name: 'Pro example', max_venues: 1, max_devices: 2 })
  assert.equal((await db.query('select feature_key from public.tenant_feature_assignments where tenant_id=$1', [ids.otherTenant])).rows[0].feature_key, 'promotions')

  const body = { p_tenant_id: ids.tenant, p_name: 'Must not apply', p_slug: 'must-not-apply', p_max_venues: 1, p_max_devices: 2,
    p_feature_keys: ['restaurant', 'analytics_advanced', 'quick_sale', '__addon_catalog_v2', '__assist_catalog_v1'] }
  await assert.rejects(run(body), (error) => error.code === '22023')
  assert.deepEqual(await features(), ['analytics_advanced', 'restaurant'])
  assert.equal((await db.query('select name from public.tenants where id=$1', [ids.tenant])).rows[0].name, 'Pro example')
  await assert.rejects(run({ ...body, p_feature_keys: ['restaurant'], p_max_devices: 0 }), (error) => error.code === 'P0001')
  assert.deepEqual(await features(), ['analytics_advanced', 'restaurant'])
})
