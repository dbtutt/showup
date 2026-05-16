-- Run this in Supabase SQL Editor (Database → SQL Editor → New Query)

-- Users table: stores email + profile per user
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  city text not null,
  genres jsonb default '[]',
  artists jsonb default '[]',
  push_subscription jsonb default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Watchlist: shows a user is tracking + their last known status
create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  tm_event_id text not null,
  artist text not null,
  venue text,
  event_date text,
  last_status text default 'announced',
  ticket_url text,
  price text,
  alerted_on_sale boolean default false,
  alerted_announced boolean default false,
  created_at timestamptz default now(),
  unique(user_id, tm_event_id)
);

-- Index for fast cron lookups
create index if not exists watchlist_user_id_idx on watchlist(user_id);
create index if not exists users_email_idx on users(email);

-- Enable Row Level Security
alter table users enable row level security;
alter table watchlist enable row level security;

-- Allow service role full access (used by our API functions)
create policy "service role full access users" on users
  for all using (true) with check (true);

create policy "service role full access watchlist" on watchlist
  for all using (true) with check (true);
