begin;

create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references public.members(id) on delete set null,
  name text not null,
  category text not null default 'other',
  site text,
  username text,
  email text,
  password text,
  recovery text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_credentials_organization on public.credentials(organization_id);
create index if not exists idx_credentials_category on public.credentials(category);

drop trigger if exists set_credentials_updated_at on public.credentials;
create trigger set_credentials_updated_at
before update on public.credentials
for each row execute function public.set_updated_at();

alter table public.credentials enable row level security;

drop policy if exists credentials_select_authenticated on public.credentials;
drop policy if exists credentials_insert_authenticated on public.credentials;
drop policy if exists credentials_update_authenticated on public.credentials;
drop policy if exists credentials_delete_authenticated on public.credentials;

create policy credentials_select_authenticated
on public.credentials for select to authenticated
using (true);

create policy credentials_insert_authenticated
on public.credentials for insert to authenticated
with check (true);

create policy credentials_update_authenticated
on public.credentials for update to authenticated
using (true)
with check (true);

create policy credentials_delete_authenticated
on public.credentials for delete to authenticated
using (true);

commit;
