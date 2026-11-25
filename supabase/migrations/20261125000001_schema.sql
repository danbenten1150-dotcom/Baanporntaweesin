-- ════════════════════════════════════════════════════════════════════
-- Baan PornTaweesin — core schema
-- Timezone: all timestamps are timestamptz; business day = Asia/Bangkok
-- Currency: THB, numeric(12,2)
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

alter database postgres set timezone to 'Asia/Bangkok';

-- ───────── Enums ─────────
create type app_role as enum ('customer', 'staff', 'admin');
create type account_type as enum ('individual', 'company');
create type booking_status as enum ('pending_review','awaiting_quotation','awaiting_payment','confirmed','cargo_received','loading','in_transit','arrived','delivered','cancelled');
create type payment_status as enum ('unpaid','pending_verification','deposit_paid','paid','refunded');
create type transport_mode as enum ('port_to_port','door_to_port','port_to_door','door_to_door');
create type cargo_category as enum ('general','construction_materials','sand_stone','cement','car','motorcycle','truck','heavy_machinery','other');
create type construction_service as enum ('residential','commercial','renovation','land_preparation','excavation','foundation','concrete','demolition','general');
create type construction_status as enum ('submitted','contacted','inspection_scheduled','quotation_sent','accepted','rejected','in_progress','completed','cancelled');
create type machinery_type as enum ('dump_truck','crane','excavator','heavy','transport');
create type machinery_booking_status as enum ('pending_review','awaiting_quotation','confirmed','in_progress','completed','cancelled','rejected');
create type order_status as enum ('quotation_requested','quoted','awaiting_payment','confirmed','delivering','delivered','cancelled');
create type quotation_kind as enum ('cargo','construction','machinery','order');
create type quotation_status as enum ('draft','sent','accepted','rejected','expired');
create type payment_verify_status as enum ('pending','verified','rejected');

-- ───────── Users / customers ─────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text check (tax_id ~ '^\d{13}$'),
  address text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One row per auth user ("Users" = auth.users, "Customer profiles" = profiles)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  full_name text not null default '',
  phone text check (phone is null or phone ~ '^0\d{8,9}$'),
  email text,
  line_id text,
  account_type account_type not null default 'individual',
  company_id uuid references companies(id) on delete set null,
  tax_id text check (tax_id is null or tax_id ~ '^\d{13}$'),
  pdpa_consent_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (phone);

create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text,
  address text not null,
  created_at timestamptz not null default now()
);

-- ───────── Marine ─────────
create table ports (
  id text primary key,
  code text unique not null,
  name_th text not null,
  name_en text not null
);

create table routes (
  id text primary key,
  code text unique not null,
  origin_port_id text not null references ports(id),
  dest_port_id text not null references ports(id),
  name_th text not null,
  name_en text not null,
  duration_min int check (duration_min is null or duration_min > 0),
  rate_per_ton numeric(12,2) check (rate_per_ton is null or rate_per_ton >= 0), -- null = staff confirms price
  active boolean not null default true,
  check (origin_port_id <> dest_port_id)
);

create table vessels (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  vessel_type text not null default '',
  cargo_capacity_tons numeric(10,3) not null check (cargo_capacity_tons >= 0),
  vehicle_capacity int not null default 0 check (vehicle_capacity >= 0),
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  photo_url text,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table sailing_schedules (
  id text primary key default gen_random_uuid()::text,
  route_id text not null references routes(id),
  vessel_id text not null references vessels(id),
  depart_at timestamptz not null,
  arrive_at timestamptz not null,
  capacity_tons numeric(10,3) not null check (capacity_tons >= 0),
  booked_tons numeric(10,3) not null default 0 check (booked_tons >= 0),
  vehicle_slots int not null default 0 check (vehicle_slots >= 0),
  booked_vehicles int not null default 0 check (booked_vehicles >= 0),
  status text not null default 'open' check (status in ('open','full','closed','cancelled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (arrive_at > depart_at),
  check (booked_tons <= capacity_tons),        -- overbooking is impossible at the row level
  check (booked_vehicles <= vehicle_slots),
  -- a vessel cannot be assigned two overlapping, non-cancelled sailings
  constraint sailing_no_vessel_overlap exclude using gist (
    vessel_id with =, tstzrange(depart_at, arrive_at) with &&
  ) where (status <> 'cancelled')
);
create index on sailing_schedules (route_id, depart_at);

create table cargo_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references profiles(id) on delete set null,
  schedule_id text references sailing_schedules(id),
  route_id text not null references routes(id),
  ship_date date not null,
  transport_mode transport_mode not null,
  contact jsonb not null,                 -- snapshot of contact details at booking time
  contact_phone text generated always as (contact->>'phone') stored,
  pickup_location text,
  delivery_location text,
  total_tons numeric(10,3) not null default 0,
  total_vehicles int not null default 0,
  capacity_held boolean not null default false,  -- true while the sailing capacity is reserved
  status booking_status not null default 'pending_review',
  payment_status payment_status not null default 'unpaid',
  price numeric(12,2) check (price is null or price >= 0),
  estimated_price numeric(12,2),
  internal_notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on cargo_bookings (contact_phone);
create index on cargo_bookings (schedule_id);

create table cargo_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references cargo_bookings(id) on delete cascade,
  category cargo_category not null,
  description text not null,
  quantity int not null check (quantity > 0),
  weight numeric(12,3) not null check (weight > 0),
  weight_unit text not null check (weight_unit in ('kg','ton')),
  length_m numeric(8,2), width_m numeric(8,2), height_m numeric(8,2),
  vehicle_reg text,
  special text
);

-- Shared status history for every trackable entity
create table booking_status_history (
  id bigint generated always as identity primary key,
  entity_type quotation_kind not null,
  entity_id uuid not null,
  status text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);
create index on booking_status_history (entity_type, entity_id, at);

-- ───────── Construction ─────────
create table construction_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references profiles(id) on delete set null,
  project_type construction_service not null,
  location text not null,
  project_size text, land_size text, budget text,
  start_date date, end_date date, inspection_date date,
  description text not null,
  contact jsonb not null,
  contact_phone text generated always as (contact->>'phone') stored,
  status construction_status not null default 'submitted',
  assigned_to uuid references profiles(id) on delete set null,
  assigned_name text,
  progress int not null default 0 check (progress between 0 and 100),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on construction_requests (contact_phone);

-- ───────── Machinery ─────────
-- Asia/Bangkok is a fixed UTC+7 offset (no DST), so this is safe to mark immutable.
create or replace function public.machinery_period(p_start date, p_duration int, p_unit text) returns tstzrange
language sql immutable as $$
  select tstzrange(
    (p_start::timestamp - interval '7 hours')::timestamp at time zone 'UTC',
    (p_start::timestamp - interval '7 hours')::timestamp at time zone 'UTC'
      + case when p_unit = 'day' then make_interval(days => p_duration) else make_interval(hours => p_duration) end)
$$;

create table machinery (
  id text primary key default gen_random_uuid()::text,
  machinery_type machinery_type not null,
  name text not null,
  capacity text,
  status text not null default 'available' check (status in ('available','maintenance','inactive')),
  rate_hour numeric(12,2), rate_day numeric(12,2),
  is_demo boolean not null default false
);

create table machinery_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references profiles(id) on delete set null,
  machinery_type machinery_type not null,
  machinery_id text references machinery(id),
  capacity text,
  location text not null,
  start_date date not null,
  duration int not null check (duration between 1 and 365),
  rate_unit text not null check (rate_unit in ('hour','day')),
  operator boolean not null default false,
  description text not null,
  contact jsonb not null,
  contact_phone text generated always as (contact->>'phone') stored,
  status machinery_booking_status not null default 'pending_review',
  period tstzrange generated always as (public.machinery_period(start_date, duration, rate_unit)) stored,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  -- the same machine can never have two overlapping confirmed / in-progress bookings
  constraint machinery_bookings_no_overlap exclude using gist (
    machinery_id with =, period with &&
  ) where (status in ('confirmed','in_progress') and machinery_id is not null)
);

-- ───────── Store ─────────
create table product_categories (
  id text primary key,
  slug text unique not null,
  name_th text not null,
  name_en text not null,
  sort int not null default 0
);

create table products (
  id text primary key default gen_random_uuid()::text,
  category_id text not null references product_categories(id),
  name_th text not null, name_en text not null,
  desc_th text not null default '', desc_en text not null default '',
  spec text not null default '',
  unit_th text not null, unit_en text not null,
  price numeric(12,2) check (price is null or price >= 0), -- null → request quotation
  stock numeric(12,3) check (stock is null or stock >= 0),
  delivery text[] not null default '{pickup,truck,ship}',
  image_url text,
  active boolean not null default true,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references profiles(id) on delete set null,
  delivery_location text not null,
  with_transport boolean not null default false,
  route_id text references routes(id),
  notes text,
  contact jsonb not null,
  contact_phone text generated always as (contact->>'phone') stored,
  status order_status not null default 'quotation_requested',
  payment_status payment_status not null default 'unpaid',
  subtotal numeric(12,2),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id text references products(id) on delete set null,
  name text not null,
  unit text not null,
  qty numeric(12,3) not null check (qty > 0),
  unit_price numeric(12,2)
);

-- ───────── Quotations & payments ─────────
create table quotations (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  kind quotation_kind not null,
  target_ref text not null,
  customer_phone text not null,
  customer_id uuid references profiles(id) on delete set null,
  vat_rate numeric(5,2) not null default 7 check (vat_rate between 0 and 100),
  deposit_percent numeric(5,2) check (deposit_percent is null or deposit_percent between 0 and 100),
  notes text,
  valid_until date,
  status quotation_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  description text not null,
  qty numeric(12,3) not null check (qty > 0),
  unit text not null default '',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  sort int not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  target_kind quotation_kind not null,
  target_ref text not null,
  customer_phone text not null,
  customer_id uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('deposit','full','balance')),
  method text not null check (method in ('bank_transfer','promptpay')),
  slip_path text not null,                      -- private storage object, never public
  status payment_verify_status not null default 'pending',
  note text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────── Documents / notifications / audit / settings ─────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  entity_type quotation_kind,
  entity_ref text,
  bucket text not null default 'documents',
  path text not null,
  kind text not null default 'attachment', -- attachment | quotation | invoice | booking_summary | slip
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('admin','customer')),
  customer_id uuid references profiles(id) on delete cascade,
  customer_phone text,
  title_th text not null, title_en text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  channel_status jsonb not null default '{}'::jsonb, -- {line: 'sent', email: 'skipped', ...}
  created_at timestamptz not null default now()
);
create index on notifications (audience, created_at desc);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor text not null default 'system',
  action text not null,
  entity text not null,
  entity_ref text not null,
  at timestamptz not null default now()
);

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  service text not null,
  message text not null,
  contact jsonb not null,
  created_at timestamptz not null default now()
);

create table site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into site_settings (id, data) values (1, '{}'::jsonb) on conflict do nothing;
