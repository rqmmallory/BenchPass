-- BenchPass initial schema
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text,
  phone        text,
  address      text,
  sms_from     text,          -- Twilio number assigned to this shop
  plan         text not null default 'solo', -- 'solo' | 'shop'
  -- Tracks the Stripe lifecycle so the app can enforce read-only mode after
  -- cancellation and show trial state. 'trialing' | 'active' | 'past_due' | 'canceled'
  subscription_status text not null default 'trialing',
  -- Set at onboarding; drives the 14-day trial countdown and the day-12 reminder.
  trial_ends_at timestamptz,
  stripe_customer_id  text,
  stripe_subscription_id text,
  created_at   timestamptz default now()
);

create table users (
  id      uuid primary key references auth.users(id),
  shop_id uuid references shops(id) not null,
  email   text not null,
  role    text not null default 'owner'
);

create table customers (
  id       uuid primary key default gen_random_uuid(),
  shop_id  uuid references shops(id) not null,
  name     text not null,
  phone    text,
  email    text,
  notes    text,
  created_at timestamptz default now()
);

create table instruments (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid references shops(id) not null,
  customer_id uuid references customers(id),
  type        text,           -- 'guitar' | 'bass' | 'violin' etc.
  make        text,
  model       text,
  serial      text,
  photo_urls  text[],         -- Supabase Storage paths
  notes       text,
  created_at  timestamptz default now()
);

create table tickets (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid references shops(id) not null,
  customer_id        uuid references customers(id) not null,
  instrument_id      uuid references instruments(id),
  public_token       text unique not null default encode(gen_random_bytes(16),'hex'),
  status             text not null default 'queued',
                     -- queued | in_progress | waiting_on_parts | ready | picked_up
  problem            text not null,      -- free-text; what the customer reported
  internal_notes     text,               -- private bench notes
  customer_summary   text,               -- AI-cleaned customer-facing summary
  quote_cents        integer,
  deposit_cents      integer default 0,
  parts_status       text,               -- e.g. "ordered from StewMac, ETA Fri"
  intake_at          timestamptz default now(),
  ready_at           timestamptz,
  picked_up_at       timestamptz,
  -- Powers the "you forgot to call them" 14-day staleness nudge on the board.
  updated_at         timestamptz not null default now(),
  created_at         timestamptz default now()
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid references tickets(id) not null,
  channel    text not null,   -- 'sms' | 'email'
  body       text not null,
  sent_at    timestamptz default now(),
  twilio_sid text
);

create table templates (
  id       uuid primary key default gen_random_uuid(),
  shop_id  uuid references shops(id) not null,
  key      text not null,  -- 'received' | 'ready' | 'quote_update' | 'reminder'
  body     text not null,
  unique(shop_id, key)
);

create table price_presets (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid references shops(id) not null,
  label       text not null,   -- e.g. "Full setup"
  amount_cents integer not null
);

-- Indexes for the hot paths: board query, public page lookup, fuzzy search.
create index tickets_shop_status_idx on tickets (shop_id, status);
create index tickets_public_token_idx on tickets (public_token);
create index customers_shop_idx on customers (shop_id);
create index instruments_customer_idx on instruments (customer_id);
create index messages_ticket_idx on messages (ticket_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_tickets_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_updated_at
  before update on tickets
  for each row execute function set_tickets_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Every tenant-scoped row is visible only to users of that shop.
-- ---------------------------------------------------------------------------

-- Helper: the caller's shop id (security definer so it can read users under RLS).
create or replace function current_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from users where id = auth.uid()
$$;

alter table shops enable row level security;
alter table users enable row level security;
alter table customers enable row level security;
alter table instruments enable row level security;
alter table tickets enable row level security;
alter table messages enable row level security;
alter table templates enable row level security;
alter table price_presets enable row level security;

create policy "own shop" on shops
  for all using (id = current_shop_id()) with check (id = current_shop_id());

create policy "own user row" on users
  for select using (id = auth.uid());

create policy "shop customers" on customers
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy "shop instruments" on instruments
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy "shop tickets" on tickets
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

-- Messages have no shop_id; scope through the parent ticket.
create policy "shop messages" on messages
  for all using (
    exists (select 1 from tickets t where t.id = ticket_id and t.shop_id = current_shop_id())
  ) with check (
    exists (select 1 from tickets t where t.id = ticket_id and t.shop_id = current_shop_id())
  );

create policy "shop templates" on templates
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy "shop price presets" on price_presets
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

-- Note: shops/users rows are created during onboarding by the service-role
-- client (bypasses RLS); the public customer page also reads via service role
-- keyed by the unguessable public_token. Anonymous users have no policies.

-- ---------------------------------------------------------------------------
-- Default templates for every new shop
-- ---------------------------------------------------------------------------

create or replace function seed_shop_templates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into templates (shop_id, key, body) values
    (new.id, 'received',     'Hi {customer_name}, we''ve received your {instrument} at {shop_name}. We''ll be in touch with a quote shortly.'),
    (new.id, 'ready',        'Hi {customer_name}, great news — your {instrument} is ready for pickup at {shop_name}. See your repair summary: {public_url}'),
    (new.id, 'quote_update', 'Hi {customer_name}, here''s the updated quote for your {instrument} at {shop_name}: ${quote}. Reply to approve.'),
    (new.id, 'reminder',     'Hi {customer_name}, just a reminder that your {instrument} is ready at {shop_name}. Let us know when you''d like to pick it up.');
  return new;
end;
$$;

create trigger shops_seed_templates
  after insert on shops
  for each row execute function seed_shop_templates();

-- ---------------------------------------------------------------------------
-- Storage: one public bucket for instrument photos + shop logos.
-- Paths are unguessable (uuid segments); writes are restricted to the
-- owning shop's folder.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "shop uploads photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'shops'
    and (storage.foldername(name))[2] = current_shop_id()::text
  );

create policy "shop deletes photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'shops'
    and (storage.foldername(name))[2] = current_shop_id()::text
  );
