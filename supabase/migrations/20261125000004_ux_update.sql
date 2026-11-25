-- ════════════════════════════════════════════════════════════════════
-- UX update: simpler customer booking
--  • customers may answer "ไม่ทราบน้ำหนัก / ไม่ทราบขนาด" → booking is flagged for staff review
--  • customers may request a date without picking a sailing (staff assign one)
--  • company name / tax ID optional for customers
--  • staff can edit and reschedule bookings (capacity moved atomically)
--  • real-time feed for the admin dashboard
-- Safe to run after migrations 0001–0003.
-- ════════════════════════════════════════════════════════════════════

alter table cargo_items alter column weight drop not null;
alter table cargo_items drop constraint if exists cargo_items_weight_check;
alter table cargo_items add constraint cargo_items_weight_check check (weight is null or weight > 0);
alter table cargo_items add column if not exists weight_unknown boolean not null default false;
alter table cargo_items add column if not exists size_unknown boolean not null default false;
alter table cargo_items add constraint cargo_items_weight_known check (weight is not null or weight_unknown);

alter table cargo_bookings add column if not exists needs_review boolean not null default false;
alter table cargo_bookings add column if not exists customer_notes text;

-- Company details are optional; if a tax ID is given it must be 13 digits
create or replace function public.clean_contact(c jsonb) returns jsonb
language plpgsql immutable as $$
declare ph text := public.norm_phone(c->>'phone'); company text := nullif(trim(coalesce(c->>'company_name','')), '');
begin
  if coalesce(length(trim(c->>'full_name')), 0) < 2 then raise exception 'validation:contact.full_name'; end if;
  if ph !~ '^0\d{8,9}$' then raise exception 'validation:contact.phone'; end if;
  if coalesce(c->>'tax_id','') <> '' and (c->>'tax_id') !~ '^\d{13}$' then raise exception 'validation:contact.tax_id'; end if;
  if coalesce(c->>'email','') <> '' and (c->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'validation:contact.email'; end if;
  return jsonb_build_object(
    'type', case when company is not null or c->>'type' = 'company' then 'company' else 'individual' end,
    'full_name', trim(c->>'full_name'), 'company_name', company, 'phone', ph,
    'email', nullif(trim(coalesce(c->>'email','')), ''), 'line_id', nullif(trim(coalesce(c->>'line_id','')), ''),
    'tax_id', nullif(trim(coalesce(c->>'tax_id','')), ''));
end $$;

-- Totals for a booking's items (unknown weights count as 0 until staff fill them in)
create or replace function public.cargo_totals(p_booking uuid, out tons numeric, out vehicles int, out unknown boolean)
language sql stable as $$
  select coalesce(sum(case when weight is null then 0 when weight_unit = 'kg' then weight / 1000 else weight end), 0),
         coalesce(sum(case when category in ('car','motorcycle','truck','heavy_machinery') then quantity else 0 end), 0)::int,
         coalesce(bool_or(weight is null or weight_unknown or size_unknown), false)
  from cargo_items where booking_id = p_booking
$$;

create or replace function public.submit_cargo_booking(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sailing_schedules%rowtype;
  v_contact jsonb := public.clean_contact(payload->'contact');
  v_mode transport_mode := coalesce(nullif(payload->>'transport_mode',''), 'port_to_port')::transport_mode;
  v_route text := payload->>'route_id';
  v_sched text := nullif(payload->>'schedule_id','');
  v_date date := nullif(payload->>'ship_date','')::date;
  v_id uuid; v_ref text; v_rate numeric; it jsonb; tot record;
  v_settings jsonb := (select data from site_settings where id = 1);
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if jsonb_array_length(coalesce(payload->'items','[]')) = 0 then raise exception 'validation:items'; end if;
  if not exists (select 1 from routes where id = v_route and active) then raise exception 'validation:route_id'; end if;
  if coalesce((v_settings->'transport_modes'->>v_mode::text)::boolean, true) is not true then raise exception 'business:mode_disabled'; end if;
  if v_mode in ('door_to_port','door_to_door') and coalesce(trim(payload->>'pickup_location'),'') = '' then raise exception 'validation:pickup_location'; end if;
  if v_mode in ('port_to_door','door_to_door') and coalesce(trim(payload->>'delivery_location'),'') = '' then raise exception 'validation:delivery_location'; end if;

  for it in select * from jsonb_array_elements(payload->'items') loop
    if coalesce(length(trim(it->>'description')),0) < 2 or coalesce((it->>'quantity')::int, 0) < 1 then raise exception 'validation:items'; end if;
    if not coalesce((it->>'weight_unknown')::boolean, false) and coalesce(nullif(it->>'weight','')::numeric, 0) <= 0 then raise exception 'validation:items'; end if;
  end loop;

  if v_sched is not null then
    select * into s from sailing_schedules where id = v_sched for share;
    if not found or s.status <> 'open' or s.route_id <> v_route or s.depart_at < now() then raise exception 'business:schedule_unavailable'; end if;
    v_date := (s.depart_at at time zone 'Asia/Bangkok')::date;
  end if;
  if v_date is null or v_date < (now() at time zone 'Asia/Bangkok')::date then raise exception 'validation:ship_date'; end if;

  v_ref := public.gen_ref('C');
  insert into cargo_bookings (ref, customer_id, schedule_id, route_id, ship_date, transport_mode, contact, pickup_location, delivery_location, customer_notes)
  values (v_ref, auth.uid(), v_sched, v_route, v_date, v_mode, v_contact,
          nullif(trim(payload->>'pickup_location'),''), nullif(trim(payload->>'delivery_location'),''), nullif(trim(payload->>'notes'),''))
  returning id into v_id;

  insert into cargo_items (booking_id, category, description, quantity, weight, weight_unit, length_m, width_m, height_m, vehicle_reg, special, weight_unknown, size_unknown)
  select v_id, (e->>'category')::cargo_category, trim(e->>'description'), (e->>'quantity')::int,
         case when coalesce((e->>'weight_unknown')::boolean,false) then null else nullif(e->>'weight','')::numeric end,
         coalesce(e->>'weight_unit','ton'),
         nullif(e->>'length_m','')::numeric, nullif(e->>'width_m','')::numeric, nullif(e->>'height_m','')::numeric,
         nullif(e->>'vehicle_reg',''), nullif(e->>'special',''),
         coalesce((e->>'weight_unknown')::boolean,false), coalesce((e->>'size_unknown')::boolean,false)
  from jsonb_array_elements(payload->'items') e;

  select * into tot from public.cargo_totals(v_id);
  -- capacity pre-check only when the sailing and weights are known; the binding check happens at staff confirmation
  if v_sched is not null and not tot.unknown then
    if s.booked_tons + tot.tons > s.capacity_tons then raise exception 'business:capacity'; end if;
    if tot.vehicles > 0 and s.booked_vehicles + tot.vehicles > s.vehicle_slots then raise exception 'business:vehicle_capacity'; end if;
  end if;
  select rate_per_ton into v_rate from routes where id = v_route;
  update cargo_bookings set total_tons = tot.tons, total_vehicles = tot.vehicles,
         needs_review = tot.unknown or v_sched is null,
         estimated_price = case when v_rate is not null and not tot.unknown then round(v_rate * tot.tons, 2) end
   where id = v_id;

  insert into documents (owner_id, entity_type, entity_ref, path)
  select auth.uid(), 'cargo', v_ref, f from jsonb_array_elements_text(coalesce(payload->'files','[]')) f;

  perform public.log_status('cargo', v_id, 'pending_review', 'Submitted online');
  perform public.push_notification('admin', null, 'มีคำขอจองเรือใหม่', 'New cargo booking request', v_ref, '/admin/#bookings');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำขอจองเรือแล้ว', 'Booking request received', v_ref);
  perform public.write_audit('create', 'cargo_booking', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'needs_review', tot.unknown or v_sched is null);
end $$;

-- Confirmation now also requires a sailing and known weights
create or replace function public.confirm_cargo_booking(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b cargo_bookings%rowtype; s sailing_schedules%rowtype; tot record;
begin
  perform public.require_staff();
  select * into b from cargo_bookings where id = p_id for update;
  if not found then raise exception 'business:not_found'; end if;
  if b.status not in ('pending_review','awaiting_quotation','awaiting_payment') or b.capacity_held then raise exception 'business:state'; end if;
  select * into tot from public.cargo_totals(p_id);
  if b.schedule_id is null or exists (select 1 from cargo_items where booking_id = p_id and weight is null) then raise exception 'business:needs_details'; end if;
  select * into s from sailing_schedules where id = b.schedule_id for update;
  if not found or s.status in ('cancelled','closed') then raise exception 'business:schedule'; end if;
  if s.booked_tons + tot.tons > s.capacity_tons then raise exception 'business:capacity'; end if;
  if s.booked_vehicles + tot.vehicles > s.vehicle_slots then raise exception 'business:vehicle_capacity'; end if;
  update sailing_schedules
     set booked_tons = booked_tons + tot.tons, booked_vehicles = booked_vehicles + tot.vehicles,
         status = case when booked_tons + tot.tons >= capacity_tons then 'full' else status end
   where id = s.id;
  update cargo_bookings set status = 'confirmed', capacity_held = true, needs_review = false,
         total_tons = tot.tons, total_vehicles = tot.vehicles, updated_at = now() where id = p_id;
  perform public.log_status('cargo', p_id, 'confirmed');
  perform public.push_notification('customer', b.contact_phone, 'การจองเรือของคุณได้รับการยืนยันแล้ว', 'Your cargo booking is confirmed', b.ref);
  perform public.write_audit('confirm', 'cargo_booking', b.ref);
end $$;

-- Staff edit / reschedule. If capacity is already reserved it is moved inside one transaction.
create or replace function public.update_cargo_booking(p_id uuid, payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare b cargo_bookings%rowtype; old_s sailing_schedules%rowtype; new_s sailing_schedules%rowtype; tot record;
  v_sched text; v_moved boolean;
begin
  perform public.require_staff();
  select * into b from cargo_bookings where id = p_id for update;
  if not found then raise exception 'business:not_found'; end if;
  if b.status in ('delivered','cancelled') then raise exception 'business:state'; end if;
  v_sched := case when payload ? 'schedule_id' then nullif(payload->>'schedule_id','') else b.schedule_id end;
  v_moved := v_sched is distinct from b.schedule_id;

  if b.capacity_held then  -- release what is held now
    select * into old_s from sailing_schedules where id = b.schedule_id for update;
    update sailing_schedules set booked_tons = greatest(0, booked_tons - b.total_tons), booked_vehicles = greatest(0, booked_vehicles - b.total_vehicles),
           status = case when status = 'full' then 'open' else status end where id = b.schedule_id;
  end if;

  if payload ? 'items' then
    delete from cargo_items where booking_id = p_id;
    insert into cargo_items (booking_id, category, description, quantity, weight, weight_unit, length_m, width_m, height_m, vehicle_reg, special, weight_unknown, size_unknown)
    select p_id, (e->>'category')::cargo_category, trim(e->>'description'), (e->>'quantity')::int,
           nullif(e->>'weight','')::numeric, coalesce(e->>'weight_unit','ton'),
           nullif(e->>'length_m','')::numeric, nullif(e->>'width_m','')::numeric, nullif(e->>'height_m','')::numeric,
           nullif(e->>'vehicle_reg',''), nullif(e->>'special',''),
           nullif(e->>'weight','') is null, coalesce((e->>'size_unknown')::boolean,false)
    from jsonb_array_elements(payload->'items') e;
  end if;
  select * into tot from public.cargo_totals(p_id);

  if v_sched is not null then
    select * into new_s from sailing_schedules where id = v_sched for update;
    if not found or new_s.status in ('cancelled','closed') then raise exception 'business:schedule'; end if;
  end if;
  if b.capacity_held then  -- re-reserve on the (possibly new) sailing
    if v_sched is null or exists (select 1 from cargo_items where booking_id = p_id and weight is null) then raise exception 'business:needs_details'; end if;
    if new_s.booked_tons + tot.tons > new_s.capacity_tons then raise exception 'business:capacity'; end if;
    if new_s.booked_vehicles + tot.vehicles > new_s.vehicle_slots then raise exception 'business:vehicle_capacity'; end if;
    update sailing_schedules set booked_tons = booked_tons + tot.tons, booked_vehicles = booked_vehicles + tot.vehicles,
           status = case when booked_tons + tot.tons >= capacity_tons then 'full' else status end where id = v_sched;
  end if;

  update cargo_bookings set
    schedule_id = v_sched,
    route_id = coalesce(new_s.route_id, b.route_id),
    ship_date = coalesce((new_s.depart_at at time zone 'Asia/Bangkok')::date, nullif(payload->>'ship_date','')::date, b.ship_date),
    transport_mode = coalesce(nullif(payload->>'transport_mode','')::transport_mode, b.transport_mode),
    pickup_location = case when payload ? 'pickup_location' then nullif(payload->>'pickup_location','') else pickup_location end,
    delivery_location = case when payload ? 'delivery_location' then nullif(payload->>'delivery_location','') else delivery_location end,
    total_tons = tot.tons, total_vehicles = tot.vehicles,
    needs_review = (tot.unknown or v_sched is null) and not capacity_held,
    updated_at = now()
  where id = p_id;
  perform public.log_status('cargo', p_id, b.status::text, case when v_moved then 'Rescheduled' else 'Edited by staff' end);
  if v_moved then perform public.push_notification('customer', b.contact_phone, 'มีการเปลี่ยนรอบเรือของคุณ', 'Your sailing was changed', b.ref); end if;
  perform public.write_audit(case when v_moved then 'reschedule' else 'edit' end, 'cargo_booking', b.ref);
end $$;

revoke all on function public.update_cargo_booking(uuid, jsonb) from anon;
grant execute on function public.update_cargo_booking(uuid, jsonb) to authenticated;

-- Real-time feed for the admin dashboard (rows still filtered by RLS per subscriber)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table cargo_bookings, construction_requests, machinery_bookings, orders, payments, notifications;
  end if;
end $$;
