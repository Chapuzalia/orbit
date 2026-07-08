-- Orbit / Supabase schema
-- Run this file in the Supabase SQL editor before starting the app.
-- It creates the full data model used by the dashboard without inserting mock data.

begin;

create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'Business',
  cif text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  title text,
  role text,
  phone text,
  availability text not null default 'available',
  capacity numeric not null default 40,
  logged numeric not null default 0,
  skills text[] not null default '{}',
  joined date,
  color text,
  avatar_url text,
  bio text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (organization_id, email)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  tax_id text,
  contact text,
  email text,
  phone text,
  address text,
  status text not null default 'lead',
  type text,
  revenue numeric not null default 0,
  pending numeric not null default 0,
  active_projects integer not null default 0,
  completed_projects integer not null default 0,
  last_contact timestamptz,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.members(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'idea',
  priority text not null default 'medium',
  progress integer not null default 0 check (progress between 0 and 100),
  member_ids uuid[] not null default '{}',
  start_date date,
  due_date timestamptz,
  budget numeric not null default 0,
  estimated_hours numeric not null default 0,
  logged_hours numeric not null default 0,
  risk text not null default 'low',
  tech text[] not null default '{}',
  supabase_dashboard_url text,
  public_url text,
  github_repo_full_name text,
  repo_ids uuid[] not null default '{}',
  server_ids uuid[] not null default '{}',
  last_activity timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists supabase_dashboard_url text;
alter table public.projects add column if not exists public_url text;
alter table public.projects add column if not exists github_repo_full_name text;

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid references public.members(id) on delete set null,
  name text not null,
  description text,
  date timestamptz,
  status text not null default 'todo',
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.members(id) on delete set null,
  title text not null,
  collaborators uuid[] not null default '{}',
  status text not null default 'todo',
  priority text not null default 'medium',
  start_date timestamptz,
  due_date timestamptz,
  estimate numeric not null default 0,
  logged numeric not null default 0,
  tags text[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb,
  comments integer not null default 0,
  subtasks integer not null default 0,
  repo_issue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  description text,
  visibility text not null default 'private',
  language text,
  stars integer not null default 0,
  open_issues integer not null default 0,
  open_prs integer not null default 0,
  last_commit timestamptz,
  last_release text,
  ci text not null default 'passing',
  branches integer not null default 0,
  contributors uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pull_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  repo_id uuid references public.repositories(id) on delete cascade,
  number integer not null,
  title text not null,
  author_id uuid references public.members(id) on delete set null,
  status text not null default 'open',
  reviewers uuid[] not null default '{}',
  additions integer not null default 0,
  deletions integer not null default 0,
  created_at timestamptz not null default now(),
  checks text not null default 'passing',
  updated_at timestamptz not null default now(),
  unique (repo_id, number)
);

create table if not exists public.commits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  repo_id uuid references public.repositories(id) on delete cascade,
  message text not null,
  author_id uuid references public.members(id) on delete set null,
  sha text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  repo_id uuid references public.repositories(id) on delete cascade,
  name text not null,
  status text not null default 'passing',
  branch text,
  duration text,
  run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  provider text,
  ip inet,
  location text,
  os text,
  status text not null default 'operational',
  agent_token_hash text,
  uptime text,
  cpu integer not null default 0,
  ram integer not null default 0,
  disk integer not null default 0,
  load numeric not null default 0,
  latency integer not null default 0,
  services text[] not null default '{}',
  docker integer not null default 0,
  domains text[] not null default '{}',
  ssl text not null default 'n/a',
  ssl_expiry timestamptz,
  last_check timestamptz,
  incidents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.servers add column if not exists agent_token_hash text;

create table if not exists public.server_metrics (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  cpu integer not null check (cpu between 0 and 100),
  ram integer not null check (ram between 0 and 100),
  disk integer not null check (disk between 0 and 100),
  load numeric not null default 0,
  latency integer not null default 0,
  uptime text,
  status text not null default 'operational',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.report_server_metrics(
  p_server_id uuid,
  p_token text,
  p_cpu integer,
  p_ram integer,
  p_disk integer,
  p_load numeric default 0,
  p_latency integer default 0,
  p_uptime text default null,
  p_status text default 'operational'
)
returns public.server_metrics
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_server public.servers%rowtype;
  metric public.server_metrics%rowtype;
  next_status text;
begin
  select * into target_server
  from public.servers
  where id = p_server_id;

  if target_server.id is null then
    raise exception 'server_not_found';
  end if;

  if target_server.agent_token_hash is null
     or p_token is null
     or crypt(p_token, target_server.agent_token_hash) <> target_server.agent_token_hash then
    raise exception 'invalid_server_token';
  end if;

  next_status := coalesce(p_status, 'operational');
  if greatest(p_cpu, p_ram, p_disk) >= 90 then
    next_status := 'critical';
  elsif greatest(p_cpu, p_ram, p_disk) >= 75 and next_status = 'operational' then
    next_status := 'warning';
  end if;

  insert into public.server_metrics (
    server_id,
    organization_id,
    cpu,
    ram,
    disk,
    load,
    latency,
    uptime,
    status
  )
  values (
    target_server.id,
    target_server.organization_id,
    least(greatest(p_cpu, 0), 100),
    least(greatest(p_ram, 0), 100),
    least(greatest(p_disk, 0), 100),
    coalesce(p_load, 0),
    coalesce(p_latency, 0),
    p_uptime,
    next_status
  )
  returning * into metric;

  update public.servers
  set
    cpu = metric.cpu,
    ram = metric.ram,
    disk = metric.disk,
    load = metric.load,
    latency = metric.latency,
    uptime = coalesce(metric.uptime, public.servers.uptime),
    status = metric.status,
    last_check = metric.checked_at,
    updated_at = now()
  where id = target_server.id;

  return metric;
end;
$$;

grant execute on function public.report_server_metrics(uuid, text, integer, integer, integer, numeric, integer, text, text) to anon, authenticated;

create or replace function public.create_monitored_server(
  p_organization_id uuid,
  p_name text,
  p_agent_token text,
  p_provider text default null,
  p_ip inet default null,
  p_location text default null,
  p_os text default null,
  p_domains text[] default '{}',
  p_services text[] default '{}'
)
returns public.servers
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  created public.servers%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'server_name_required';
  end if;

  if p_agent_token is null or length(p_agent_token) < 24 then
    raise exception 'agent_token_too_short';
  end if;

  insert into public.servers (
    organization_id,
    name,
    provider,
    ip,
    location,
    os,
    status,
    agent_token_hash,
    domains,
    services,
    last_check
  )
  values (
    p_organization_id,
    trim(p_name),
    p_provider,
    p_ip,
    p_location,
    p_os,
    'offline',
    crypt(p_agent_token, gen_salt('bf')),
    coalesce(p_domains, '{}'),
    coalesce(p_services, '{}'),
    null
  )
  returning * into created;

  return created;
end;
$$;

grant execute on function public.create_monitored_server(uuid, text, text, text, inet, text, text, text[], text[]) to authenticated;

create table if not exists public.invoices (
  id text primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric not null default 0,
  status text not null default 'draft',
  issued timestamptz,
  due timestamptz,
  concept text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  amount numeric not null default 0,
  method text,
  date timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  plan text not null,
  amount numeric not null default 0,
  interval text not null default 'month',
  status text not null default 'active',
  started date,
  next_invoice timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_by_month (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  month text not null,
  ingresos numeric not null default 0,
  recurrente numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  actor_id uuid references public.members(id) on delete set null,
  text text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  start timestamptz not null,
  duration integer not null default 30,
  status text not null default 'scheduled',
  location text,
  link text,
  attendees uuid[] not null default '{}',
  external_attendees text[] not null default '{}',
  agenda text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid references public.members(id) on delete set null,
  name text not null,
  shared boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.todo_lists(id) on delete cascade,
  assignee_id uuid references public.members(id) on delete set null,
  text text not null,
  done boolean not null default false,
  priority text not null default 'medium',
  due timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade unique,
  notifications jsonb not null default '{"email":true,"push":true,"servers":true,"billing":false,"weekly":true}'::jsonb,
  theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_members_organization on public.members(organization_id);
create index if not exists idx_members_auth_user on public.members(auth_user_id);
create index if not exists idx_clients_organization on public.clients(organization_id);
create index if not exists idx_projects_organization on public.projects(organization_id);
create index if not exists idx_projects_client on public.projects(client_id);
create index if not exists idx_tasks_organization on public.tasks(organization_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_milestones_project on public.milestones(project_id);
create index if not exists idx_repositories_project on public.repositories(project_id);
create index if not exists idx_pull_requests_repo on public.pull_requests(repo_id);
create index if not exists idx_commits_repo on public.commits(repo_id);
create index if not exists idx_workflows_repo on public.workflows(repo_id);
create index if not exists idx_server_metrics_server_checked on public.server_metrics(server_id, checked_at desc);
create index if not exists idx_invoices_client on public.invoices(client_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_notifications_member on public.notifications(member_id);
create index if not exists idx_meetings_start on public.meetings(start);
create index if not exists idx_todo_items_list on public.todo_items(list_id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organizations',
    'members',
    'clients',
    'projects',
    'milestones',
    'tasks',
    'repositories',
    'pull_requests',
    'workflows',
    'servers',
    'server_metrics',
    'invoices',
    'payments',
    'subscriptions',
    'revenue_by_month',
    'notifications',
    'meetings',
    'todo_lists',
    'todo_items',
    'user_preferences',
    'integrations'
  ]
  loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', tbl, tbl);
    execute format(
      'create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl,
      tbl
    );
  end loop;
end $$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organizations',
    'members',
    'clients',
    'projects',
    'milestones',
    'tasks',
    'repositories',
    'pull_requests',
    'commits',
    'workflows',
    'servers',
    'server_metrics',
    'invoices',
    'payments',
    'subscriptions',
    'revenue_by_month',
    'notifications',
    'activity',
    'meetings',
    'todo_lists',
    'todo_items',
    'user_preferences',
    'integrations'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_select_authenticated', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_insert_authenticated', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_update_authenticated', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_delete_authenticated', tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)', tbl || '_select_authenticated', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', tbl || '_insert_authenticated', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', tbl || '_update_authenticated', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (true)', tbl || '_delete_authenticated', tbl);
  end loop;
end $$;

commit;
