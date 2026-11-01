-- Exact function snapshot from POS/supabase/migrations/20261005225011_tickit_assist.sql. Isolated tests only.
-- Source migration SHA256: DC757AD44898BB4A7A35C60DE3C74490551EC7684A1B15580984ABF4C8D4B87C
create or replace function public.update_platform_tenant_config(
  p_tenant_id uuid,
  p_name text,
  p_slug text,
  p_max_venues integer,
  p_max_devices integer,
  p_feature_keys text[]
)
returns table (id uuid, name text, slug text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_devices integer;
  current_venues integer;
  had_multi_device boolean;
  legacy_request boolean := not ('__addon_catalog_v2' = any(coalesce(p_feature_keys, array[]::text[])));
  requested text[] := array(
    select distinct case feature_key
      when 'discounts' then 'promotions'
      when 'inventory_recipes' then 'costing'
      when 'supplier_documents' then 'purchases'
      when 'supplier_document_scanning' then 'document_ai'
      else feature_key
    end
    from unnest(coalesce(p_feature_keys, array[]::text[])) input(feature_key)
    where feature_key not in ('multi_device', '__addon_catalog_v2', '__assist_catalog_v1')
  );
begin
  perform 1 from public.tenants where tenants.id = p_tenant_id for update;
  if not found then raise exception 'Negocio no encontrado' using errcode = 'P0002'; end if;

  select count(*) into current_venues from public.venues where venues.tenant_id = p_tenant_id;
  select count(*) into current_devices from public.devices where devices.tenant_id = p_tenant_id and devices.is_active = true;
  if p_max_venues < current_venues or p_max_devices < current_devices then
    raise exception 'Los límites no pueden ser inferiores al uso actual del negocio' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_feature_keys, array[]::text[])) input(feature_key)
    where feature_key is null or feature_key not in ('analytics_advanced', 'restaurant', 'reservations', 'production', 'inventory', 'costing', 'purchases', 'document_ai', 'promotions', 'cashlogy', 'discounts', 'inventory_recipes', 'supplier_documents', 'supplier_document_scanning', 'multi_device', '__addon_catalog_v2', '__assist_catalog_v1', 'tickit_assist')
  ) then
    raise exception 'La selección contiene addons no válidos' using errcode = '22023';
  end if;

  if 'reservations' = any(requested) or 'production' = any(requested) then requested := array_append(requested, 'restaurant'); end if;
  if 'costing' = any(requested) then requested := array_append(requested, 'inventory'); end if;
  if 'document_ai' = any(requested) then requested := array_append(requested, 'purchases'); requested := array_append(requested, 'inventory'); end if;
  requested := array(select distinct feature_key from unnest(requested) feature_key);

  -- A legacy client cannot display the new-only addons, so retain those entitlements.
  if legacy_request then
    requested := array(
      select distinct feature_key from unnest(requested) feature_key
      union
      select assignment.feature_key from public.tenant_feature_assignments assignment
      where assignment.tenant_id = p_tenant_id and assignment.feature_key in ('analytics_advanced', 'cashlogy')
    );
  end if;

  if not ('__assist_catalog_v1' = any(coalesce(p_feature_keys,array[]::text[]))) then
    requested := array(select distinct key from (select unnest(requested) as key union select feature_key from public.tenant_feature_assignments where tenant_id=p_tenant_id and feature_key='tickit_assist') preserved);
  end if;
  update public.tenants set name = p_name, slug = p_slug, max_venues = p_max_venues, max_devices = p_max_devices, updated_at = now()
  where tenants.id = p_tenant_id;
  select exists (
    select 1 from public.tenant_feature_assignments assignment
    where assignment.tenant_id = p_tenant_id and assignment.feature_key = 'multi_device'
  ) into had_multi_device;
  delete from public.tenant_feature_assignments where tenant_feature_assignments.tenant_id = p_tenant_id;
  insert into public.tenant_feature_assignments (tenant_id, feature_key)
  select p_tenant_id, feature_key from (
    select feature_key from unnest(requested) feature_key
    union
    select case feature_key
      when 'promotions' then 'discounts'
      when 'costing' then 'inventory_recipes'
      when 'purchases' then 'supplier_documents'
      when 'document_ai' then 'supplier_document_scanning'
    end from unnest(requested) feature_key
    where feature_key in ('promotions', 'costing', 'purchases', 'document_ai')
    union
    select 'multi_device' where
      (legacy_request and 'multi_device' = any(coalesce(p_feature_keys, array[]::text[])))
      or (not legacy_request and had_multi_device)
  ) assignments;

  return query select tenants.id, tenants.name, tenants.slug from public.tenants where tenants.id = p_tenant_id;
end;
$$;
