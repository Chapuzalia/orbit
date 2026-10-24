import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { TickitPosService, readTickitConfig } from '../mcp/modules/tickit-pos/service.mjs'
import { createSupabaseFixture, tickitEnv, ids } from './helpers/tickit-supabase.mjs'

test('actual Tickit catalog RPCs preserve transaction, format links and venue boundaries', { timeout: 30000 }, async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create schema auth;
    create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
    create function public.user_is_tenant_admin(uuid) returns boolean language sql stable as $$ select false $$;`)
  await db.exec(await readFile(new URL('./fixtures/tickit-catalog.sql', import.meta.url), 'utf8'))
  await db.query('insert into venues(id,tenant_id,name) values($1,$2,$3),($4,$5,$6)', [ids.venue, ids.tenant, 'Staging', ids.otherVenue, ids.otherTenant, 'Other venue'])
  await db.query('insert into catalog_sale_formats(id,tenant_id,venue_id,name) values($1,$2,$3,$4)', [ids.format, ids.tenant, ids.venue, 'Unidad'])
  const fixture = createSupabaseFixture()
  const service = new TickitPosService(readTickitConfig(tickitEnv), fixture)
  await service.catalogCommand('products_create', { venue_id: ids.venue, confirm: true, data: { type: 'standard', name: 'Coffee', variants: [{ name: 'Unidad', priceCents: 150, formatId: ids.format }] } })
  const args = fixture.state.requests.find((r) => r.path.endsWith('/catalog_command_batch_with_formats')).body
  const run = (input) => db.query('select public.catalog_command_batch_with_formats($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb) result',
    [input.p_venue_id, JSON.stringify(input.p_commands), JSON.stringify(input.p_variant_formats), JSON.stringify(input.p_new_formats)])
  const result = await run(args)
  assert.equal(result.rows[0].result.result, 'SUCCESS')
  const saved = await db.query('select p.name,v.price_cents,v.catalog_sale_format_id from products p join product_variants v on v.product_id=p.id where p.id=$1', [args.p_commands[0].payload.id])
  assert.equal(saved.rows[0].name, 'Coffee')
  assert.equal(saved.rows[0].price_cents, 150)
  assert.equal(saved.rows[0].catalog_sale_format_id, ids.format)

  await t.test('invalid variant rolls back the whole product', async () => {
    const invalid = structuredClone(args)
    invalid.p_commands[0].payload.id = randomUUID()
    invalid.p_commands[0].payload.variants[0].id = randomUUID()
    invalid.p_commands[0].payload.variants[0].priceCents = -1
    invalid.p_variant_formats[0].variantId = invalid.p_commands[0].payload.variants[0].id
    await assert.rejects(run(invalid), /price_cents_check/)
    assert.equal((await db.query('select id from products where id=$1', [invalid.p_commands[0].payload.id])).rows.length, 0)
  })
  await t.test('another venue cannot update an existing product through the RPC', async () => {
    await assert.rejects(db.query('select public.catalog_command($1::uuid,$2::text,$3::jsonb)', [ids.otherVenue, 'update_product', JSON.stringify({ id: args.p_commands[0].payload.id, name: 'Stolen' })]), /CATALOG_PRODUCT_NOT_FOUND/)
    assert.equal((await db.query('select name from products where id=$1', [args.p_commands[0].payload.id])).rows[0].name, 'Coffee')
  })
})
