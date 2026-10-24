-- Snapshot of Tickit POS catalog schema/RPCs, used only in isolated tests.
-- Source: POS/supabase/0.Complete_Database_24-07-26.sql and 20260812120000_fix_catalog_batch_format_upsert.sql.
CREATE TABLE public.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    legal_name text,
    tax_id text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tables_enabled boolean DEFAULT false NOT NULL,
    default_tax_rate numeric(5,2) DEFAULT 21 NOT NULL,
    manual_discount_enabled boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'Europe/Madrid'::text NOT NULL,
    day_change_time time without time zone,
    currency_code text DEFAULT 'EUR'::text NOT NULL,
    catalog_profile text DEFAULT 'bar_classic'::text NOT NULL,
    CONSTRAINT venues_address_check CHECK (((address IS NULL) OR (char_length(address) <= 300))),
    CONSTRAINT venues_catalog_profile_check CHECK ((catalog_profile = ANY (ARRAY['bar_classic'::text, 'restaurant'::text, 'custom'::text]))),
    CONSTRAINT venues_default_tax_rate_check CHECK (((default_tax_rate >= (0)::numeric) AND (default_tax_rate <= (100)::numeric))),
    CONSTRAINT venues_legal_name_check CHECK (((legal_name IS NULL) OR (char_length(legal_name) <= 80))),
    CONSTRAINT venues_tax_id_check CHECK (((tax_id IS NULL) OR (char_length(tax_id) <= 80))),
    CONSTRAINT venues_ticket_fiscal_details_check CHECK ((((address IS NULL) OR (char_length(address) <= 300)) AND ((legal_name IS NULL) OR (char_length(legal_name) <= 80)) AND ((tax_id IS NULL) OR (char_length(tax_id) <= 80))))
);
ALTER TABLE public.venues ADD PRIMARY KEY(id);
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tax_rate numeric(5,2),
    product_type text DEFAULT 'standard'::text NOT NULL,
    CONSTRAINT products_product_type_check CHECK ((product_type = ANY (ARRAY['standard'::text, 'menu'::text]))),
    CONSTRAINT products_tax_rate_check CHECK (((tax_rate IS NULL) OR ((tax_rate >= (0)::numeric) AND (tax_rate <= (100)::numeric))))
);
ALTER TABLE public.products ADD PRIMARY KEY(id);
CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    sku text,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    venue_id uuid NOT NULL,
    catalog_sale_format_id uuid,
    CONSTRAINT product_variants_price_cents_check CHECK ((price_cents >= 0))
);
ALTER TABLE public.product_variants ADD PRIMARY KEY(id);
CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    icon text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    venue_id uuid NOT NULL,
    unused boolean DEFAULT false NOT NULL
);
ALTER TABLE public.categories ADD PRIMARY KEY(id);
CREATE TABLE public.catalog_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    icon text DEFAULT 'receipt'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_tabs_key_check CHECK (((key ~ '^[a-z0-9_]+$'::text) AND (key <> ALL (ARRAY['all'::text, 'top'::text])))),
    CONSTRAINT catalog_tabs_label_check CHECK (((char_length(TRIM(BOTH FROM label)) >= 1) AND (char_length(TRIM(BOTH FROM label)) <= 80)))
);
ALTER TABLE public.catalog_tabs ADD PRIMARY KEY(id);
CREATE TABLE public.catalog_placements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    tab_id uuid NOT NULL,
    category_id uuid,
    product_id uuid NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    variant_id uuid
);
ALTER TABLE public.catalog_placements ADD PRIMARY KEY(id);
CREATE TABLE public.catalog_tab_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    tab_id uuid NOT NULL,
    category_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_tab_categories_sort_order_check CHECK ((sort_order >= 0))
);
ALTER TABLE public.catalog_tab_categories ADD PRIMARY KEY(id);
CREATE TABLE public.catalog_sale_formats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_sale_formats_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)))
);
ALTER TABLE public.catalog_sale_formats ADD PRIMARY KEY(id);
CREATE TABLE public.product_images (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    product_id uuid NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_images_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT product_images_size_bytes_check CHECK ((size_bytes >= 0))
);
ALTER TABLE public.product_images ADD PRIMARY KEY(id);
CREATE TABLE public.modifier_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    venue_id uuid NOT NULL
);
ALTER TABLE public.modifier_groups ADD PRIMARY KEY(id);
CREATE TABLE public.modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    venue_id uuid NOT NULL,
    supplement_cents integer DEFAULT 0 NOT NULL,
    CONSTRAINT modifiers_supplement_cents_check CHECK (((supplement_cents >= '-100000000'::integer) AND (supplement_cents <= 100000000)))
);
ALTER TABLE public.modifiers ADD PRIMARY KEY(id);
CREATE TABLE public.product_modifier_group_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    product_id uuid NOT NULL,
    group_id uuid NOT NULL,
    display_name text,
    min_selection integer DEFAULT 0 NOT NULL,
    max_selection integer DEFAULT 1 NOT NULL,
    applies_to_all_variants boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_modifier_group_assignments_check CHECK (((max_selection >= 1) AND (max_selection >= min_selection))),
    CONSTRAINT product_modifier_group_assignments_min_selection_check CHECK ((min_selection >= 0)),
    CONSTRAINT product_modifier_group_assignments_sort_order_check CHECK ((sort_order >= 0))
);
ALTER TABLE public.product_modifier_group_assignments ADD PRIMARY KEY(id);
CREATE TABLE public.product_modifier_group_assignment_variants (
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.selection_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT selection_groups_kind_check CHECK ((kind = ANY (ARRAY['mixer'::text, 'menu_component'::text]))),
    CONSTRAINT selection_groups_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 100)))
);
ALTER TABLE public.selection_groups ADD PRIMARY KEY(id);
CREATE TABLE public.selection_group_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    group_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    supplement_cents integer DEFAULT 0 NOT NULL,
    default_quantity integer DEFAULT 0 NOT NULL,
    max_quantity integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT selection_group_options_check CHECK (((max_quantity IS NULL) OR (max_quantity >= default_quantity))),
    CONSTRAINT selection_group_options_default_quantity_check CHECK ((default_quantity >= 0)),
    CONSTRAINT selection_group_options_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT selection_group_options_supplement_cents_check CHECK (((supplement_cents >= '-100000000'::integer) AND (supplement_cents <= 100000000)))
);
ALTER TABLE public.selection_group_options ADD PRIMARY KEY(id);
CREATE TABLE public.product_selection_group_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    product_id uuid NOT NULL,
    group_id uuid NOT NULL,
    display_name text,
    min_selection integer DEFAULT 0 NOT NULL,
    max_selection integer DEFAULT 1 NOT NULL,
    applies_to_all_variants boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_selection_group_assignments_check CHECK (((max_selection >= 1) AND (max_selection >= min_selection))),
    CONSTRAINT product_selection_group_assignments_min_selection_check CHECK ((min_selection >= 0)),
    CONSTRAINT product_selection_group_assignments_sort_order_check CHECK ((sort_order >= 0))
);
ALTER TABLE public.product_selection_group_assignments ADD PRIMARY KEY(id);
CREATE TABLE public.product_selection_group_assignment_variants (
    tenant_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.catalog_tab_categories ADD UNIQUE(tab_id,category_id);
ALTER TABLE public.product_images ADD UNIQUE(product_id);
CREATE FUNCTION public.catalog_command(p_venue_id uuid, p_command text, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_tenant_id uuid;
  v_id uuid;
  v_product_id uuid;
  v_group_id uuid;
  v_variant_id uuid;
  v_item jsonb;
  v_table text;
  v_path text;
  v_orphaned_paths text[] := '{}';
  v_default_count integer;
  v_default_assigned boolean := false;
begin
  select v.tenant_id into v_tenant_id from public.venues v where v.id = p_venue_id for update;
  if v_tenant_id is null then raise exception 'CATALOG_VENUE_NOT_FOUND'; end if;
  if auth.role() <> 'service_role' and not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'CATALOG_COMMAND_FORBIDDEN';
  end if;

  if p_command = 'create_product' then
    if jsonb_typeof(p_payload -> 'variants') <> 'array' or jsonb_array_length(p_payload -> 'variants') = 0 then
      raise exception 'CATALOG_PRODUCT_REQUIRES_VARIANT';
    end if;
    select count(*) into v_default_count from jsonb_array_elements(p_payload -> 'variants') x
      where coalesce((x ->> 'active')::boolean, true) and coalesce((x ->> 'isDefault')::boolean, false);
    if v_default_count > 1 then raise exception 'INVALID_ACTIVE_DEFAULT_VARIANT_COUNT'; end if;
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.products(id, tenant_id, venue_id, name, description, product_type, tax_rate, is_active, sort_order)
    values (v_id, v_tenant_id, p_venue_id, trim(p_payload ->> 'name'), nullif(p_payload ->> 'description', ''),
      p_payload ->> 'type', nullif(p_payload ->> 'vatRate', '')::numeric,
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer);
    for v_item in select value from jsonb_array_elements(p_payload -> 'variants') loop
      if v_default_count = 0 and not v_default_assigned and coalesce((v_item ->> 'active')::boolean, true) then
        v_item := jsonb_set(v_item, '{isDefault}', 'true'::jsonb);
        v_default_assigned := true;
      end if;
      v_variant_id := coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid());
      insert into public.product_variants(id, tenant_id, venue_id, product_id, name, price_cents, sku,
        is_default, is_active, sort_order)
      values (v_variant_id, v_tenant_id, p_venue_id, v_id, trim(v_item ->> 'name'),
        (v_item ->> 'priceCents')::integer, nullif(v_item ->> 'sku', ''),
        coalesce((v_item ->> 'isDefault')::boolean, false),
        coalesce((v_item ->> 'active')::boolean, true), (v_item ->> 'sortOrder')::integer);
    end loop;

  elsif p_command = 'update_product' then
    v_id := (p_payload ->> 'id')::uuid;
    if p_payload ? 'active' and not (p_payload ->> 'active')::boolean then
      update public.product_selection_group_assignments set is_active = false where product_id = v_id and venue_id = p_venue_id;
      update public.product_modifier_group_assignments set is_active = false where product_id = v_id and venue_id = p_venue_id;
    end if;
    update public.products p set
      name = case when p_payload ? 'name' then trim(p_payload ->> 'name') else p.name end,
      description = case when p_payload ? 'description' then nullif(p_payload ->> 'description', '') else p.description end,
      product_type = case when p_payload ? 'type' then p_payload ->> 'type' else p.product_type end,
      tax_rate = case when p_payload ? 'vatRate' then nullif(p_payload ->> 'vatRate', '')::numeric else p.tax_rate end,
      is_active = case when p_payload ? 'active' then (p_payload ->> 'active')::boolean else p.is_active end,
      sort_order = case when p_payload ? 'sortOrder' then (p_payload ->> 'sortOrder')::integer else p.sort_order end
    where p.id = v_id and p.venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_PRODUCT_NOT_FOUND'; end if;

  elsif p_command = 'set_product_active' then
    v_id := (p_payload ->> 'id')::uuid;
    if not (p_payload ->> 'active')::boolean then
      update public.product_selection_group_assignments set is_active = false where product_id = v_id and venue_id = p_venue_id;
      update public.product_modifier_group_assignments set is_active = false where product_id = v_id and venue_id = p_venue_id;
    end if;
    update public.products set is_active = (p_payload ->> 'active')::boolean where id = v_id and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_PRODUCT_NOT_FOUND'; end if;

  elsif p_command = 'delete_product' then
    v_id := (p_payload ->> 'id')::uuid;
    select i.storage_path into v_path from public.product_images i where i.product_id = v_id and i.venue_id = p_venue_id;
    delete from public.products where id = v_id and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_PRODUCT_NOT_FOUND'; end if;
    if v_path is not null and not exists (select 1 from public.product_images where storage_path = v_path) then
      v_orphaned_paths := array_append(v_orphaned_paths, v_path);
    end if;

  elsif p_command in ('create_variant', 'update_variant') then
    v_product_id := (p_payload ->> 'productId')::uuid;
    if not exists (select 1 from public.products where id = v_product_id and venue_id = p_venue_id) then
      raise exception 'CATALOG_PRODUCT_NOT_FOUND';
    end if;
    v_id := case when p_command = 'update_variant' then (p_payload ->> 'id')::uuid
      else coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid()) end;
    if coalesce((p_payload ->> 'isDefault')::boolean, false) then
      update public.product_variants set is_default = false where product_id = v_product_id and venue_id = p_venue_id;
    end if;
    if p_command = 'create_variant' then
      insert into public.product_variants(id, tenant_id, venue_id, product_id, name, price_cents, sku,
        is_default, is_active, sort_order)
      values(v_id, v_tenant_id, p_venue_id, v_product_id, trim(p_payload ->> 'name'),
        (p_payload ->> 'priceCents')::integer, nullif(p_payload ->> 'sku', ''),
        coalesce((p_payload ->> 'isDefault')::boolean, false), coalesce((p_payload ->> 'active')::boolean, true),
        (p_payload ->> 'sortOrder')::integer);
    else
      update public.product_variants v set
        name = case when p_payload ? 'name' then trim(p_payload ->> 'name') else v.name end,
        price_cents = case when p_payload ? 'priceCents' then (p_payload ->> 'priceCents')::integer else v.price_cents end,
        sku = case when p_payload ? 'sku' then nullif(p_payload ->> 'sku', '') else v.sku end,
        is_default = case when p_payload ? 'isDefault' then (p_payload ->> 'isDefault')::boolean else v.is_default end,
        is_active = case when p_payload ? 'active' then (p_payload ->> 'active')::boolean else v.is_active end,
        sort_order = case when p_payload ? 'sortOrder' then (p_payload ->> 'sortOrder')::integer else v.sort_order end
      where v.id = v_id and v.product_id = v_product_id and v.venue_id = p_venue_id;
      if not found then raise exception 'CATALOG_VARIANT_NOT_FOUND'; end if;
    end if;

  elsif p_command = 'set_default_variant' then
    v_product_id := (p_payload ->> 'productId')::uuid;
    v_variant_id := (p_payload ->> 'variantId')::uuid;
    if not exists (select 1 from public.product_variants where id = v_variant_id and product_id = v_product_id and venue_id = p_venue_id and is_active) then
      raise exception 'CATALOG_VARIANT_PRODUCT_MISMATCH';
    end if;
    update public.product_variants set is_default = (id = v_variant_id)
      where product_id = v_product_id and venue_id = p_venue_id;

  elsif p_command = 'delete_variant' then
    v_product_id := (p_payload ->> 'productId')::uuid;
    v_id := (p_payload ->> 'id')::uuid;
    if exists (select 1 from public.product_variants where id = v_id and product_id = v_product_id and venue_id = p_venue_id and is_active and is_default) then
      raise exception 'CATALOG_DEFAULT_VARIANT_REQUIRES_REPLACEMENT';
    end if;
    delete from public.product_variants where id = v_id and product_id = v_product_id and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_VARIANT_NOT_FOUND'; end if;

  elsif p_command in ('create_placement', 'update_placement') then
    v_id := case when p_command = 'update_placement' then (p_payload ->> 'id')::uuid
      else coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid()) end;
    if p_command = 'create_placement' then
      insert into public.catalog_placements(id, tenant_id, venue_id, product_id, tab_id, category_id, variant_id,
        is_featured, is_active, sort_order)
      values(v_id, v_tenant_id, p_venue_id, (p_payload ->> 'productId')::uuid, (p_payload ->> 'tabId')::uuid,
        nullif(p_payload ->> 'categoryId', '')::uuid, nullif(p_payload ->> 'pinnedVariantId', '')::uuid,
        coalesce((p_payload ->> 'featured')::boolean, false), coalesce((p_payload ->> 'active')::boolean, true),
        (p_payload ->> 'sortOrder')::integer);
    else
      update public.catalog_placements cp set
        product_id = case when p_payload ? 'productId' then (p_payload ->> 'productId')::uuid else cp.product_id end,
        tab_id = case when p_payload ? 'tabId' then (p_payload ->> 'tabId')::uuid else cp.tab_id end,
        category_id = case when p_payload ? 'categoryId' then nullif(p_payload ->> 'categoryId', '')::uuid else cp.category_id end,
        variant_id = case when p_payload ? 'pinnedVariantId' then nullif(p_payload ->> 'pinnedVariantId', '')::uuid else cp.variant_id end,
        is_featured = case when p_payload ? 'featured' then (p_payload ->> 'featured')::boolean else cp.is_featured end,
        is_active = case when p_payload ? 'active' then (p_payload ->> 'active')::boolean else cp.is_active end,
        sort_order = case when p_payload ? 'sortOrder' then (p_payload ->> 'sortOrder')::integer else cp.sort_order end
      where cp.id = v_id and cp.venue_id = p_venue_id;
      if not found then raise exception 'CATALOG_PLACEMENT_INVALID'; end if;
    end if;

  elsif p_command = 'delete_placement' then
    delete from public.catalog_placements where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_PLACEMENT_INVALID'; end if;

  elsif p_command = 'save_tab' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.catalog_tabs(id, tenant_id, venue_id, key, label, icon, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, p_payload ->> 'key', trim(p_payload ->> 'label'), nullif(p_payload ->> 'icon', ''),
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set key = excluded.key, label = excluded.label, icon = excluded.icon,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where catalog_tabs.venue_id = p_venue_id;

  elsif p_command = 'delete_tab' then
    delete from public.catalog_tabs where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_PLACEMENT_INVALID'; end if;

  elsif p_command = 'save_category' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.categories(id, tenant_id, venue_id, name, icon, unused, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, trim(p_payload ->> 'name'), nullif(p_payload ->> 'icon', ''),
      coalesce((p_payload ->> 'unused')::boolean, false), coalesce((p_payload ->> 'active')::boolean, true),
      (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set name = excluded.name, icon = excluded.icon, unused = excluded.unused,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where categories.venue_id = p_venue_id;

  elsif p_command = 'delete_category' then
    delete from public.categories where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'save_selection_group' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.selection_groups(id, tenant_id, venue_id, kind, name, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, p_payload ->> 'type', trim(p_payload ->> 'name'),
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set kind = excluded.kind, name = excluded.name,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where selection_groups.venue_id = p_venue_id;

  elsif p_command = 'delete_selection_group' then
    delete from public.selection_groups where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'save_selection_option' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.selection_group_options(id, tenant_id, venue_id, group_id, product_id, variant_id,
      supplement_cents, default_quantity, max_quantity, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, (p_payload ->> 'groupId')::uuid, (p_payload ->> 'productId')::uuid,
      nullif(p_payload ->> 'variantId', '')::uuid, (p_payload ->> 'supplementCents')::integer,
      (p_payload ->> 'defaultQuantity')::integer, nullif(p_payload ->> 'maxQuantity', '')::integer,
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set group_id = excluded.group_id, product_id = excluded.product_id,
      variant_id = excluded.variant_id, supplement_cents = excluded.supplement_cents,
      default_quantity = excluded.default_quantity, max_quantity = excluded.max_quantity,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where selection_group_options.venue_id = p_venue_id;

  elsif p_command = 'delete_selection_option' then
    delete from public.selection_group_options where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'save_modifier_group' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.modifier_groups(id, tenant_id, venue_id, name, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, trim(p_payload ->> 'name'),
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set name = excluded.name,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where modifier_groups.venue_id = p_venue_id;

  elsif p_command = 'delete_modifier_group' then
    delete from public.modifier_groups where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'save_modifier' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.modifiers(id, tenant_id, venue_id, group_id, name, supplement_cents,
      is_default, is_active, sort_order)
    values(v_id, v_tenant_id, p_venue_id, (p_payload ->> 'groupId')::uuid, trim(p_payload ->> 'name'),
      (p_payload ->> 'supplementCents')::integer, coalesce((p_payload ->> 'isDefault')::boolean, false),
      coalesce((p_payload ->> 'active')::boolean, true), (p_payload ->> 'sortOrder')::integer)
    on conflict (id) do update set group_id = excluded.group_id, name = excluded.name,
      supplement_cents = excluded.supplement_cents, is_default = excluded.is_default,
      is_active = excluded.is_active, sort_order = excluded.sort_order
    where modifiers.venue_id = p_venue_id;

  elsif p_command = 'delete_modifier' then
    delete from public.modifiers where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'save_assignment' then
    v_product_id := (p_payload ->> 'productId')::uuid;
    v_group_id := (p_payload ->> 'groupId')::uuid;
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    if p_payload ->> 'domain' = 'selection' then
      insert into public.product_selection_group_assignments(id, tenant_id, venue_id, product_id, group_id,
        display_name, min_selection, max_selection, applies_to_all_variants, is_active, sort_order)
      values(v_id, v_tenant_id, p_venue_id, v_product_id, v_group_id, nullif(p_payload ->> 'displayName', ''),
        (p_payload ->> 'minSelection')::integer, (p_payload ->> 'maxSelection')::integer,
        (p_payload ->> 'appliesToAllVariants')::boolean, coalesce((p_payload ->> 'active')::boolean, true),
        (p_payload ->> 'sortOrder')::integer)
      on conflict (product_id, group_id) do update set display_name = excluded.display_name,
        min_selection = excluded.min_selection, max_selection = excluded.max_selection,
        applies_to_all_variants = excluded.applies_to_all_variants, is_active = excluded.is_active,
        sort_order = excluded.sort_order returning id into v_id;
      delete from public.product_selection_group_assignment_variants where assignment_id = v_id;
      if not (p_payload ->> 'appliesToAllVariants')::boolean then
        for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'variantIds', '[]'::jsonb)) loop
          insert into public.product_selection_group_assignment_variants(tenant_id, venue_id, assignment_id, product_id, variant_id)
          values(v_tenant_id, p_venue_id, v_id, v_product_id, (v_item #>> '{}')::uuid);
        end loop;
      end if;
    elsif p_payload ->> 'domain' = 'modifier' then
      insert into public.product_modifier_group_assignments(id, tenant_id, venue_id, product_id, group_id,
        display_name, min_selection, max_selection, applies_to_all_variants, is_active, sort_order)
      values(v_id, v_tenant_id, p_venue_id, v_product_id, v_group_id, nullif(p_payload ->> 'displayName', ''),
        (p_payload ->> 'minSelection')::integer, (p_payload ->> 'maxSelection')::integer,
        (p_payload ->> 'appliesToAllVariants')::boolean, coalesce((p_payload ->> 'active')::boolean, true),
        (p_payload ->> 'sortOrder')::integer)
      on conflict (product_id, group_id) do update set display_name = excluded.display_name,
        min_selection = excluded.min_selection, max_selection = excluded.max_selection,
        applies_to_all_variants = excluded.applies_to_all_variants, is_active = excluded.is_active,
        sort_order = excluded.sort_order returning id into v_id;
      delete from public.product_modifier_group_assignment_variants where assignment_id = v_id;
      if not (p_payload ->> 'appliesToAllVariants')::boolean then
        for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'variantIds', '[]'::jsonb)) loop
          insert into public.product_modifier_group_assignment_variants(tenant_id, venue_id, assignment_id, product_id, variant_id)
          values(v_tenant_id, p_venue_id, v_id, v_product_id, (v_item #>> '{}')::uuid);
        end loop;
      end if;
    else raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'delete_assignment' then
    if p_payload ->> 'domain' = 'selection' then
      delete from public.product_selection_group_assignments where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    elsif p_payload ->> 'domain' = 'modifier' then
      delete from public.product_modifier_group_assignments where id = (p_payload ->> 'id')::uuid and venue_id = p_venue_id;
    else raise exception 'CATALOG_GROUP_INVALID'; end if;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;

  elsif p_command = 'reorder' then
    v_table := case p_payload ->> 'entity'
      when 'products' then 'products' when 'variants' then 'product_variants'
      when 'placements' then 'catalog_placements' when 'tabs' then 'catalog_tabs'
      when 'categories' then 'categories' when 'tab_categories' then 'catalog_tab_categories'
      when 'selection_groups' then 'selection_groups' when 'selection_options' then 'selection_group_options'
      when 'selection_assignments' then 'product_selection_group_assignments'
      when 'modifier_groups' then 'modifier_groups' when 'modifiers' then 'modifiers'
      when 'modifier_assignments' then 'product_modifier_group_assignments' else null end;
    if v_table is null then raise exception 'CATALOG_INVALID_REORDER_ENTITY'; end if;
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) order by value ->> 'id' loop
      execute format('update public.%I set sort_order = $1 where id = $2 and venue_id = $3', v_table)
        using (v_item ->> 'sortOrder')::integer, (v_item ->> 'id')::uuid, p_venue_id;
      if not found then raise exception 'CATALOG_REORDER_ENTITY_NOT_FOUND'; end if;
    end loop;
  else
    raise exception 'CATALOG_UNKNOWN_COMMAND %', p_command;
  end if;

  set constraints all immediate;
  return jsonb_build_object('result', 'SUCCESS', 'id', v_id, 'orphanedImagePaths', to_jsonb(v_orphaned_paths));
end;
$_$;
CREATE FUNCTION public.catalog_command_batch(p_venue_id uuid, p_commands jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_command jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_commands) <> 'array' or jsonb_array_length(p_commands) = 0 then
    raise exception 'CATALOG_EMPTY_COMMAND_BATCH';
  end if;
  if jsonb_array_length(p_commands) > 5000 then
    raise exception 'CATALOG_COMMAND_BATCH_TOO_LARGE';
  end if;
  perform 1 from public.venues where id = p_venue_id for update;
  if not found then raise exception 'CATALOG_SCOPE_MISMATCH'; end if;
  for v_command in select value from jsonb_array_elements(p_commands) loop
    if coalesce(v_command ->> 'command', '') = '' then
      raise exception 'CATALOG_INVALID_BATCH_COMMAND';
    end if;
    if v_command ->> 'command' = 'save_tab_category' then
      v_results := v_results || jsonb_build_array(public.catalog_tab_category_command(
        p_venue_id, 'save', coalesce(v_command -> 'payload', '{}'::jsonb)
      ));
    else
      v_results := v_results || jsonb_build_array(public.catalog_command(
        p_venue_id,
        v_command ->> 'command',
        coalesce(v_command -> 'payload', '{}'::jsonb)
      ));
    end if;
  end loop;
  return jsonb_build_object('result', 'SUCCESS', 'results', v_results);
end;
$$;
CREATE FUNCTION public.catalog_tab_category_command(p_venue_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tenant_id uuid;
  v_id uuid;
begin
  select tenant_id into v_tenant_id from public.venues where id = p_venue_id for update;
  if v_tenant_id is null then raise exception 'CATALOG_SCOPE_MISMATCH'; end if;
  if auth.role() <> 'service_role' and not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'CATALOG_COMMAND_FORBIDDEN';
  end if;
  if p_action = 'save' then
    v_id := coalesce(nullif(p_payload ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.catalog_tab_categories(
      id, tenant_id, venue_id, tab_id, category_id, is_active, sort_order
    ) values (
      v_id, v_tenant_id, p_venue_id,
      (p_payload ->> 'tabId')::uuid,
      (p_payload ->> 'categoryId')::uuid,
      coalesce((p_payload ->> 'active')::boolean, true),
      (p_payload ->> 'sortOrder')::integer
    )
    on conflict (tab_id, category_id) do update set
      is_active = excluded.is_active,
      sort_order = excluded.sort_order
    where catalog_tab_categories.venue_id = p_venue_id
    returning id into v_id;
  elsif p_action = 'delete' then
    v_id := (p_payload ->> 'id')::uuid;
    if exists (
      select 1 from public.catalog_placements
      where venue_id = p_venue_id
        and tab_id = (select tab_id from public.catalog_tab_categories where id = v_id)
        and category_id = (select category_id from public.catalog_tab_categories where id = v_id)
    ) then
      raise exception 'CATALOG_TAB_CATEGORY_IN_USE';
    end if;
    delete from public.catalog_tab_categories where id = v_id and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_GROUP_INVALID'; end if;
  else
    raise exception 'CATALOG_UNKNOWN_TAB_CATEGORY_COMMAND';
  end if;
  return jsonb_build_object('result', 'SUCCESS', 'id', v_id);
end;
$$;
CREATE FUNCTION public.catalog_sale_format_command(p_venue_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tenant_id uuid;
  v_id uuid;
  v_item jsonb;
  v_name text;
begin
  select v.tenant_id into v_tenant_id from public.venues v where v.id = p_venue_id for update;
  if v_tenant_id is null then raise exception 'CATALOG_VENUE_NOT_FOUND'; end if;
  if auth.role() <> 'service_role' and not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'CATALOG_COMMAND_FORBIDDEN';
  end if;

  if p_action = 'save' then
    v_name := trim(p_payload ->> 'name');
    if coalesce(v_name, '') = '' then raise exception 'CATALOG_SALE_FORMAT_NAME_REQUIRED'; end if;
    v_id := nullif(p_payload ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.catalog_sale_formats(tenant_id, venue_id, name, is_active, sort_order)
      values(v_tenant_id, p_venue_id, v_name, coalesce((p_payload ->> 'active')::boolean, true),
        coalesce((p_payload ->> 'sortOrder')::integer, 0))
      returning id into v_id;
    else
      update public.catalog_sale_formats set
        name = v_name,
        is_active = coalesce((p_payload ->> 'active')::boolean, is_active),
        sort_order = coalesce((p_payload ->> 'sortOrder')::integer, sort_order)
      where id = v_id and venue_id = p_venue_id;
      if not found then raise exception 'CATALOG_SALE_FORMAT_NOT_FOUND'; end if;
    end if;
    update public.product_variants set name = v_name
    where catalog_sale_format_id = v_id and venue_id = p_venue_id;
  elsif p_action = 'delete' then
    v_id := (p_payload ->> 'id')::uuid;
    if exists(select 1 from public.product_variants where catalog_sale_format_id = v_id and venue_id = p_venue_id) then
      raise exception 'CATALOG_SALE_FORMAT_IN_USE';
    end if;
    delete from public.catalog_sale_formats where id = v_id and venue_id = p_venue_id;
    if not found then raise exception 'CATALOG_SALE_FORMAT_NOT_FOUND'; end if;
  elsif p_action = 'reorder' then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
      update public.catalog_sale_formats set sort_order = (v_item ->> 'sortOrder')::integer
      where id = (v_item ->> 'id')::uuid and venue_id = p_venue_id;
      if not found then raise exception 'CATALOG_SALE_FORMAT_NOT_FOUND'; end if;
    end loop;
  else
    raise exception 'CATALOG_SALE_FORMAT_ACTION_INVALID';
  end if;
  return jsonb_build_object('result', 'SUCCESS', 'id', v_id);
end;
$$;
CREATE FUNCTION public.catalog_variant_format_command(p_venue_id uuid, p_command text, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_format_id uuid;
  v_format_name text;
  v_format_active boolean;
  v_result jsonb;
  v_variant_id uuid;
begin
  if p_command not in ('create_variant', 'update_variant') then
    raise exception 'CATALOG_VARIANT_FORMAT_COMMAND_INVALID';
  end if;
  v_format_id := nullif(p_payload ->> 'formatId', '')::uuid;
  if v_format_id is null then raise exception 'CATALOG_VARIANT_FORMAT_REQUIRED'; end if;
  select name, is_active into v_format_name, v_format_active
  from public.catalog_sale_formats where id = v_format_id and venue_id = p_venue_id;
  if v_format_name is null then raise exception 'CATALOG_SALE_FORMAT_NOT_FOUND'; end if;
  if p_command = 'create_variant' and not v_format_active then raise exception 'CATALOG_SALE_FORMAT_INACTIVE'; end if;

  p_payload := jsonb_set(p_payload, '{name}', to_jsonb(v_format_name));
  v_result := public.catalog_command(p_venue_id, p_command, p_payload);
  v_variant_id := (v_result ->> 'id')::uuid;
  update public.product_variants set catalog_sale_format_id = v_format_id, name = v_format_name
  where id = v_variant_id and venue_id = p_venue_id;
  if not found then raise exception 'CATALOG_VARIANT_NOT_FOUND'; end if;
  return v_result;
end;
$$;
create or replace function public.catalog_command_batch_with_formats(
  p_venue_id uuid,
  p_commands jsonb,
  p_variant_formats jsonb,
  p_new_formats jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tenant_id uuid;
  v_result jsonb;
  v_item jsonb;
  v_format_id uuid;
  v_format_name text;
begin
  select v.tenant_id into v_tenant_id
  from public.venues v
  where v.id = p_venue_id
  for update;

  if v_tenant_id is null then raise exception 'CATALOG_VENUE_NOT_FOUND'; end if;
  if auth.role() <> 'service_role'
    and not public.user_is_tenant_admin(v_tenant_id)
  then
    raise exception 'CATALOG_COMMAND_FORBIDDEN';
  end if;
  if jsonb_typeof(p_commands) <> 'array'
    or jsonb_array_length(p_commands) = 0
  then
    raise exception 'CATALOG_EMPTY_COMMAND_BATCH';
  end if;
  if jsonb_typeof(p_variant_formats) <> 'array'
    or jsonb_array_length(p_variant_formats) = 0
  then
    raise exception 'CATALOG_VARIANT_FORMAT_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_new_formats, '[]'::jsonb)) <> 'array' then
    raise exception 'CATALOG_SALE_FORMAT_PLAN_INVALID';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_new_formats, '[]'::jsonb))
  loop
    v_format_id := nullif(v_item ->> 'id', '')::uuid;
    v_format_name := trim(v_item ->> 'name');
    if v_format_id is null or coalesce(v_format_name, '') = '' then
      raise exception 'CATALOG_SALE_FORMAT_PLAN_INVALID';
    end if;
    if exists (
      select 1
      from public.catalog_sale_formats f
      where f.id = v_format_id
        and (f.tenant_id <> v_tenant_id or f.venue_id <> p_venue_id)
    ) then
      raise exception 'CATALOG_SCOPE_MISMATCH';
    end if;

    insert into public.catalog_sale_formats (
      id,
      tenant_id,
      venue_id,
      name,
      is_active,
      sort_order
    )
    values (
      v_format_id,
      v_tenant_id,
      p_venue_id,
      v_format_name,
      coalesce((v_item ->> 'active')::boolean, true),
      coalesce((v_item ->> 'sortOrder')::integer, 0)
    )
    on conflict (id) do update
    set name = excluded.name,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order
    where catalog_sale_formats.tenant_id = v_tenant_id
      and catalog_sale_formats.venue_id = p_venue_id;
  end loop;

  v_result := public.catalog_command_batch(p_venue_id, p_commands);

  for v_item in
    select value
    from jsonb_array_elements(p_variant_formats)
  loop
    select f.name into v_format_name
    from public.catalog_sale_formats f
    where f.id = (v_item ->> 'formatId')::uuid
      and f.venue_id = p_venue_id
      and f.is_active;

    if v_format_name is null then
      raise exception 'CATALOG_SALE_FORMAT_NOT_FOUND';
    end if;

    update public.product_variants
    set catalog_sale_format_id = (v_item ->> 'formatId')::uuid,
        name = v_format_name
    where id = (v_item ->> 'variantId')::uuid
      and venue_id = p_venue_id;

    if not found then raise exception 'CATALOG_VARIANT_NOT_FOUND'; end if;
  end loop;

  return v_result;
end;
$$;
