import { z } from 'zod'
import { uuid, name, text, sortOrder, cents, rate } from './admin-schema.mjs'

const active = { active: z.boolean().optional(), sortOrder: sortOrder.default(0) }
const optionalId = { id: uuid.optional() }
const identity = z.object({ id: uuid }).strict()
const variant = z.object({ ...optionalId, name, priceCents: cents, sku: text.nullable().optional(), formatId: uuid.nullable().optional(), isDefault: z.boolean().optional(), ...active }).strict()
const product = { type: z.enum(['standard', 'menu']), name, description: text.nullable().optional(), vatRate: rate.nullable().optional(), ...active }
const placement = { productId: uuid, tabId: uuid, categoryId: uuid.nullable().optional(), pinnedVariantId: uuid.nullable().optional(), featured: z.boolean().optional(), ...active }
const assignment = { domain: z.enum(['selection', 'modifier']), productId: uuid, groupId: uuid, displayName: name.nullable().optional(),
  minSelection: z.number().int().min(0).max(100), maxSelection: z.number().int().min(0).max(100), appliesToAllVariants: z.boolean(), variantIds: z.array(uuid).max(100), ...active }
const define = (command, schema, refs = {}, rpc = 'catalog_command', action) => ({ command, schema, refs, rpc, action })
export const catalogCommands = {
  products_create: define('create_product', z.object({ ...optionalId, ...product, variants: z.array(variant).min(1).max(100) }).strict()),
  products_update: define('update_product', z.object({ ...product }).partial().extend({ id: uuid }).strict(), { id: 'products' }),
  products_set_active: define('set_product_active', z.object({ id: uuid, active: z.boolean() }).strict(), { id: 'products' }),
  products_delete: define('delete_product', identity, { id: 'products' }),
  variants_create: define('create_variant', variant.extend({ productId: uuid }), { productId: 'products', formatId: 'catalog_sale_formats' }),
  variants_update: define('update_variant', variant.extend({ id: uuid, productId: uuid }), { id: 'product_variants', productId: 'products', formatId: 'catalog_sale_formats' }),
  variants_set_default: define('set_default_variant', z.object({ productId: uuid, variantId: uuid }).strict(), { productId: 'products', variantId: 'product_variants' }),
  variants_delete: define('delete_variant', z.object({ id: uuid, productId: uuid }).strict(), { id: 'product_variants', productId: 'products' }),
  placements_create: define('create_placement', z.object({ ...optionalId, ...placement }).strict(), { productId: 'products', tabId: 'catalog_tabs', categoryId: 'categories', pinnedVariantId: 'product_variants' }),
  placements_update: define('update_placement', z.object({ ...placement, id: uuid }).strict(), { id: 'catalog_placements', productId: 'products', tabId: 'catalog_tabs', categoryId: 'categories', pinnedVariantId: 'product_variants' }),
  placements_delete: define('delete_placement', identity, { id: 'catalog_placements' }),
  tabs_save: define('save_tab', z.object({ ...optionalId, key: name, label: name, icon: text.nullable().optional(), ...active }).strict(), { id: 'catalog_tabs' }),
  tabs_delete: define('delete_tab', identity, { id: 'catalog_tabs' }),
  categories_save: define('save_category', z.object({ ...optionalId, name, icon: text.nullable().optional(), unused: z.boolean().optional(), ...active }).strict(), { id: 'categories' }),
  categories_delete: define('delete_category', identity, { id: 'categories' }),
  selection_groups_save: define('save_selection_group', z.object({ ...optionalId, name, type: z.enum(['mixer', 'menu_component']), ...active }).strict(), { id: 'selection_groups' }),
  selection_groups_delete: define('delete_selection_group', identity, { id: 'selection_groups' }),
  selection_options_save: define('save_selection_option', z.object({ ...optionalId, groupId: uuid, productId: uuid, variantId: uuid.nullable().optional(), supplementCents: cents,
    defaultQuantity: z.number().int().min(0).max(100), maxQuantity: z.number().int().min(0).max(100).nullable().optional(), ...active }).strict(), { id: 'selection_group_options', groupId: 'selection_groups', productId: 'products', variantId: 'product_variants' }),
  selection_options_delete: define('delete_selection_option', identity, { id: 'selection_group_options' }),
  modifier_groups_save: define('save_modifier_group', z.object({ ...optionalId, name, ...active }).strict(), { id: 'modifier_groups' }),
  modifier_groups_delete: define('delete_modifier_group', identity, { id: 'modifier_groups' }),
  modifiers_save: define('save_modifier', z.object({ ...optionalId, groupId: uuid, name, supplementCents: cents, isDefault: z.boolean().optional(), ...active }).strict(), { id: 'modifiers', groupId: 'modifier_groups' }),
  modifiers_delete: define('delete_modifier', identity, { id: 'modifiers' }),
  assignments_save: define('save_assignment', z.object({ ...optionalId, ...assignment }).strict()),
  assignments_delete: define('delete_assignment', z.object({ id: uuid, domain: z.enum(['selection', 'modifier']) }).strict()),
  catalog_reorder: define('reorder', z.object({ entity: z.enum(['products', 'variants', 'placements', 'tabs', 'categories', 'tab_categories', 'selection_groups', 'selection_options', 'selection_assignments', 'modifier_groups', 'modifiers', 'modifier_assignments']), items: z.array(z.object({ id: uuid, sortOrder }).strict()).min(1).max(500) }).strict()),
  sale_formats_save: define(null, z.object({ ...optionalId, name, inventoryConsumptionQuantity: z.number().positive().nullable().optional(), inventoryConsumptionUnitId: uuid.nullable().optional(), ...active }).strict(), { id: 'catalog_sale_formats', inventoryConsumptionUnitId: 'inventory_units' }, 'catalog_sale_format_command', 'save'),
  sale_formats_delete: define(null, identity, { id: 'catalog_sale_formats' }, 'catalog_sale_format_command', 'delete'),
  sale_formats_reorder: define(null, z.object({ items: z.array(z.object({ id: uuid, sortOrder }).strict()).min(1).max(500) }).strict(), {}, 'catalog_sale_format_command', 'reorder'),
  tab_categories_save: define(null, z.object({ ...optionalId, tabId: uuid, categoryId: uuid, ...active }).strict(), { id: 'catalog_tab_categories', tabId: 'catalog_tabs', categoryId: 'categories' }, 'catalog_tab_category_command', 'save'),
  tab_categories_delete: define(null, identity, { id: 'catalog_tab_categories' }, 'catalog_tab_category_command', 'delete'),
  product_images_save: define(null, z.object({ ...optionalId, productId: uuid, storagePath: z.string().min(1).max(500), mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png', 'image/avif']), sizeBytes: z.number().int().positive().max(1048576), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), { productId: 'products' }, 'catalog_image_command', 'save'),
  product_images_delete: define(null, z.object({ productId: uuid }).strict(), { productId: 'products' }, 'catalog_image_command', 'delete'),
}
