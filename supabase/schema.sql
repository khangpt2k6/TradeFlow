-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  first_name text,
  last_name text,
  phone text,
  address text,
  date_of_birth date,
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric(18, 6) not null check (quantity > 0),
  execution_price numeric(18, 6) not null check (execution_price >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.trade_orders enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_upsert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "trade_orders_select_own"
on public.trade_orders
for select
to authenticated
using (auth.uid() = user_id);

create policy "trade_orders_insert_own"
on public.trade_orders
for insert
to authenticated
with check (auth.uid() = user_id);
