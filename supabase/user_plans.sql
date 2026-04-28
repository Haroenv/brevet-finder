create table if not exists public.user_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  object_id text not null,
  status text not null check (status in ('interested', 'committed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, object_id)
);

-- Grant basic table permissions to authenticated users
grant select, insert, update, delete on public.user_plans to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_plans_updated_at on public.user_plans;
create trigger set_user_plans_updated_at
before update on public.user_plans
for each row
execute function public.set_updated_at();

alter table public.user_plans enable row level security;

drop policy if exists "users can read own plans" on public.user_plans;
create policy "users can read own plans"
on public.user_plans
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own plans" on public.user_plans;
create policy "users can insert own plans"
on public.user_plans
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own plans" on public.user_plans;
create policy "users can update own plans"
on public.user_plans
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own plans" on public.user_plans;
create policy "users can delete own plans"
on public.user_plans
for delete
using (auth.uid() = user_id);
