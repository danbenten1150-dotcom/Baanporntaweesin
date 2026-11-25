-- ════════════════════════════════════════════════════════════════════
-- Sleeper boat (passenger tickets)  ชุมพร ⇄ เกาะเต่า
-- Sailing days, times, berths and fares live in site_settings.data->'sleeper'
-- and are edited by the admin. Defaults (from the owner):
--   ชุมพร → เกาะเต่า  : Tue / Thu / Sat   (dow 2,4,6)
--   เกาะเต่า → ชุมพร  : Mon / Wed / Fri   (dow 1,3,5)
-- A request is never confirmed automatically; staff confirm it.
-- Safe to run once after migrations 0001–0004.
-- ════════════════════════════════════════════════════════════════════

-- status history uses the quotation_kind enum; add the new kind
-- (the literal 'sleeper' is only used inside function bodies / as text below,
--  so this works even when the whole file runs in one transaction)
alter type quotation_kind add value if not exists 'sleeper';

create table if not exists sleeper_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references profiles(id) on delete set null,
  direction text not null check (direction in ('cpn_tao','tao_cpn')),
  travel_date date not null,
  passengers jsonb not null check (jsonb_typeof(passengers) = 'array'),
  seats int not null check (seats between 1 and 30),
  contact jsonb not null,
  contact_phone text generated always as (contact->>'phone') stored,
  notes text,
  status text not null default 'pending_review'
    check (status in ('pending_review','confirmed','completed','cancelled','rejected')),
  price numeric(12,2) check (price is null or price >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sleeper_bookings_trip on sleeper_bookings (direction, travel_date);

alter table sleeper_bookings enable row level security;
create policy staff_all on sleeper_bookings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy own_rows on sleeper_bookings for select to authenticated
  using (customer_id = auth.uid() or contact_phone = public.my_phone());
create policy own_rows_sleeper on booking_status_history for select to authenticated using (
  entity_type::text = 'sleeper' and exists (select 1 from sleeper_bookings s where s.id = entity_id and (s.customer_id = auth.uid() or s.contact_phone = public.my_phone()))
);

-- Config helper: the admin's settings, falling back to the owner's sailing days.
create or replace function public.sleeper_leg(p_direction text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select data->'sleeper'->'legs'->p_direction from site_settings where id = 1),
    case p_direction when 'cpn_tao' then '{"weekdays":[2,4,6],"berths":null}'::jsonb
                     else '{"weekdays":[1,3,5],"berths":null}'::jsonb end)
$$;

create or replace function public.sleeper_seats_held(p_direction text, p_date date, p_except uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(seats), 0)::int from sleeper_bookings
   where direction = p_direction and travel_date = p_date
     and status not in ('cancelled','rejected') and id is distinct from p_except
$$;

-- Public: berths already held per upcoming date (counts only, no personal data)
create or replace function public.sleeper_taken(p_direction text) returns table (travel_date date, seats int)
language sql stable security definer set search_path = public as $$
  select travel_date, sum(seats)::int from sleeper_bookings
   where direction = p_direction and status not in ('cancelled','rejected')
     and travel_date >= (now() at time zone 'Asia/Bangkok')::date
   group by travel_date
$$;

create or replace function public.submit_sleeper_booking(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_contact jsonb := public.clean_contact(payload->'contact');
  v_dir text := payload->>'direction';
  v_date date;
  v_settings jsonb := (select data->'sleeper' from site_settings where id = 1);
  v_leg jsonb;
  v_pax jsonb := coalesce(payload->'passengers', '[]'::jsonb);
  v_seats int := jsonb_array_length(coalesce(payload->'passengers', '[]'::jsonb));
  v_berths int;
  v_id uuid; v_ref text := public.gen_ref('S');
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if v_dir not in ('cpn_tao','tao_cpn') then raise exception 'validation:direction'; end if;
  begin v_date := (payload->>'travel_date')::date; exception when others then raise exception 'validation:travel_date'; end;
  if v_seats < 1 or v_seats > 30 then raise exception 'validation:passengers'; end if;
  if exists (select 1 from jsonb_array_elements(v_pax) p where coalesce(length(trim(p->>'full_name')), 0) < 2) then
    raise exception 'validation:passengers.0.full_name';
  end if;
  if coalesce((v_settings->>'enabled')::boolean, true) is not true then raise exception 'business:sleeper_closed'; end if;

  v_leg := public.sleeper_leg(v_dir);
  if v_date <= (now() at time zone 'Asia/Bangkok')::date - 1
     or not (v_leg->'weekdays') @> to_jsonb(extract(dow from v_date)::int)
     or coalesce(v_settings->'closed_dates', '[]'::jsonb) ? v_date::text then
    raise exception 'business:no_sailing';
  end if;

  -- serialise bookings for the same trip so two people can't take the last berth together
  perform pg_advisory_xact_lock(hashtext('sleeper:' || v_dir || ':' || v_date::text));
  v_berths := nullif(v_leg->>'berths', '')::int;
  if v_berths is not null and public.sleeper_seats_held(v_dir, v_date) + v_seats > v_berths then
    raise exception 'business:berths';
  end if;

  insert into sleeper_bookings (ref, customer_id, direction, travel_date, passengers, seats, contact, notes)
  values (v_ref, auth.uid(), v_dir, v_date,
          (select jsonb_agg(jsonb_build_object('full_name', trim(p->>'full_name'), 'nationality', nullif(trim(coalesce(p->>'nationality','')), ''))) from jsonb_array_elements(v_pax) p),
          v_seats, v_contact, nullif(trim(coalesce(payload->>'notes','')), ''))
  returning id into v_id;

  perform public.log_status('sleeper', v_id, 'pending_review');
  perform public.push_notification('admin', null, 'มีคำขอจองตั๋วเรือนอนใหม่', 'New sleeper-boat request',
    v_ref || ' · ' || case v_dir when 'cpn_tao' then 'ชุมพร → เกาะเต่า' else 'เกาะเต่า → ชุมพร' end || ' · ' || v_date || ' · ' || v_seats || ' ท่าน', '/admin/#sleeper');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำขอจองตั๋วเรือนอนแล้ว', 'Sleeper-boat request received', v_ref);
  perform public.write_audit('create', 'sleeper_booking', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

create or replace function public.set_sleeper_status(p_id uuid, p_status text, p_price numeric, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b sleeper_bookings%rowtype; v_berths int;
begin
  perform public.require_staff();
  if p_status not in ('pending_review','confirmed','completed','cancelled','rejected') then raise exception 'business:state'; end if;
  select * into b from sleeper_bookings where id = p_id for update;
  if not found then raise exception 'business:not_found'; end if;
  -- reviving a cancelled/rejected ticket must still fit in the berths
  if p_status in ('pending_review','confirmed','completed') and b.status in ('cancelled','rejected') then
    perform pg_advisory_xact_lock(hashtext('sleeper:' || b.direction || ':' || b.travel_date::text));
    v_berths := nullif(public.sleeper_leg(b.direction)->>'berths', '')::int;
    if v_berths is not null and public.sleeper_seats_held(b.direction, b.travel_date, b.id) + b.seats > v_berths then
      raise exception 'business:berths';
    end if;
  end if;
  update sleeper_bookings set status = p_status, price = p_price where id = p_id;
  if p_status <> b.status or coalesce(p_note, '') <> '' then
    perform public.log_status('sleeper', p_id, p_status, nullif(p_note, ''));
  end if;
  perform public.push_notification('customer', b.contact_phone, 'อัปเดตสถานะตั๋วเรือนอน', 'Sleeper-boat booking updated', b.ref);
  perform public.write_audit('status:' || p_status, 'sleeper_booking', b.ref);
end $$;

-- Tracking: same function as before, plus sleeper tickets
create or replace function public.track_booking(p_ref text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ph text := public.norm_phone(p_phone); r text := upper(trim(p_ref)); res jsonb;
begin
  select jsonb_build_object('kind','cargo','id',b.id,'ref',b.ref,'status',b.status,'payment_status',b.payment_status,
           'route', rt.name_th || ' / ' || rt.name_en, 'eta', s.arrive_at, 'created_at', b.created_at,
           'service_label_th','ขนส่งสินค้าทางทะเล','service_label_en','Marine cargo')
    into res from cargo_bookings b join routes rt on rt.id = b.route_id left join sailing_schedules s on s.id = b.schedule_id
   where b.ref = r and b.contact_phone = ph;
  if res is null then
    select jsonb_build_object('kind','construction','id',id,'ref',ref,'status',status,'eta',end_date,'created_at',created_at,
             'service_label_th','งานรับเหมาก่อสร้าง','service_label_en','Construction')
      into res from construction_requests where ref = r and contact_phone = ph;
  end if;
  if res is null then
    select jsonb_build_object('kind','machinery','id',id,'ref',ref,'status',status,'eta',start_date,'created_at',created_at,
             'service_label_th','เช่าเครื่องจักร','service_label_en','Machinery rental')
      into res from machinery_bookings where ref = r and contact_phone = ph;
  end if;
  if res is null then
    select jsonb_build_object('kind','sleeper','id',id,'ref',ref,'status',status,'eta',travel_date,'created_at',created_at,
             'route', case direction when 'cpn_tao' then 'ชุมพร → เกาะเต่า / Chumphon → Koh Tao' else 'เกาะเต่า → ชุมพร / Koh Tao → Chumphon' end,
             'service_label_th','ตั๋วเรือนอน · ' || seats || ' ท่าน','service_label_en','Sleeper boat · ' || seats || ' pax')
      into res from sleeper_bookings where ref = r and contact_phone = ph;
  end if;
  if res is null then
    select jsonb_build_object('kind','order','id',id,'ref',ref,'status',status,'payment_status',payment_status,'created_at',created_at,
             'service_label_th','สั่งซื้อวัสดุก่อสร้าง','service_label_en','Materials order')
      into res from orders where ref = r and contact_phone = ph;
  end if;
  if res is null then return null; end if;
  return res || jsonb_build_object('history', coalesce((
    select jsonb_agg(jsonb_build_object('status', status, 'at', at, 'note', note) order by at)
      from booking_status_history where entity_type::text = res->>'kind' and entity_id = (res->>'id')::uuid), '[]'::jsonb));
end $$;

revoke all on function public.set_sleeper_status(uuid, text, numeric, text) from anon, public;
grant execute on function public.set_sleeper_status(uuid, text, numeric, text) to authenticated;
grant execute on function public.submit_sleeper_booking(jsonb), public.sleeper_taken(text), public.track_booking(text, text) to anon, authenticated;
revoke execute on function public.sleeper_leg(text), public.sleeper_seats_held(text, date, uuid) from anon, public;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table sleeper_bookings;
  end if;
end $$;
