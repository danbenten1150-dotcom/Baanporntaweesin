-- ════════════════════════════════════════════════════════════════════
-- Business logic (server-side validation, transaction-safe operations)
-- Every public write goes through one of these functions. They run in a
-- single transaction; capacity is protected with SELECT ... FOR UPDATE.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.gen_ref(prefix text) returns text
language plpgsql volatile as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  r text := '';
begin
  for i in 1..5 loop
    r := r || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return 'BPT-' || prefix || '-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD') || '-' || r;
end $$;

create or replace function public.norm_phone(p text) returns text
language sql immutable as $$
  select case
    when regexp_replace(coalesce(p,''), '\D', '', 'g') ~ '^66\d{9}$'
      then '0' || substr(regexp_replace(p, '\D', '', 'g'), 3)
    else regexp_replace(coalesce(p,''), '\D', '', 'g') end
$$;

-- Validates and normalises a contact jsonb. Raises on invalid input.
create or replace function public.clean_contact(c jsonb) returns jsonb
language plpgsql immutable as $$
declare ph text := public.norm_phone(c->>'phone');
begin
  if coalesce(length(trim(c->>'full_name')), 0) < 2 then raise exception 'validation:contact.full_name'; end if;
  if ph !~ '^0\d{8,9}$' then raise exception 'validation:contact.phone'; end if;
  if (c->>'type') not in ('individual','company') then raise exception 'validation:contact.type'; end if;
  if (c->>'type') = 'company' and (coalesce(c->>'company_name','') = '' or coalesce(c->>'tax_id','') !~ '^\d{13}$') then
    raise exception 'validation:contact.tax_id';
  end if;
  if coalesce(c->>'email','') <> '' and (c->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'validation:contact.email'; end if;
  return jsonb_build_object(
    'type', c->>'type', 'full_name', trim(c->>'full_name'), 'company_name', nullif(trim(coalesce(c->>'company_name','')), ''),
    'phone', ph, 'email', nullif(trim(coalesce(c->>'email','')), ''), 'line_id', nullif(trim(coalesce(c->>'line_id','')), ''),
    'tax_id', nullif(trim(coalesce(c->>'tax_id','')), ''));
end $$;

create or replace function public.push_notification(p_audience text, p_phone text, p_th text, p_en text, p_body text, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (audience, customer_phone, customer_id, title_th, title_en, body, link)
  values (p_audience, p_phone, (select id from profiles where phone = p_phone limit 1), p_th, p_en, p_body, p_link);
$$;

create or replace function public.log_status(p_kind quotation_kind, p_id uuid, p_status text, p_note text default null)
returns void language sql security definer set search_path = public as $$
  insert into booking_status_history (entity_type, entity_id, status, note, actor_id) values (p_kind, p_id, p_status, p_note, auth.uid());
$$;

create or replace function public.write_audit(p_action text, p_entity text, p_ref text)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, actor, action, entity, entity_ref)
  values (auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), 'guest'), p_action, p_entity, p_ref);
$$;

create or replace function public.require_staff() returns void language plpgsql stable as $$
begin
  if not public.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- ───────── Cargo booking (customer) ─────────
create or replace function public.submit_cargo_booking(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sailing_schedules%rowtype;
  v_contact jsonb := public.clean_contact(payload->'contact');
  v_mode transport_mode := (payload->>'transport_mode')::transport_mode;
  v_tons numeric := 0; v_veh int := 0;
  v_id uuid; v_ref text; v_rate numeric; it jsonb;
  v_settings jsonb := (select data from site_settings where id = 1);
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if jsonb_array_length(coalesce(payload->'items','[]')) = 0 then raise exception 'validation:items'; end if;
  if coalesce((v_settings->'transport_modes'->>v_mode::text)::boolean, true) is not true then raise exception 'business:mode_disabled'; end if;
  if v_mode in ('door_to_port','door_to_door') and coalesce(trim(payload->>'pickup_location'),'') = '' then raise exception 'validation:pickup_location'; end if;
  if v_mode in ('port_to_door','door_to_door') and coalesce(trim(payload->>'delivery_location'),'') = '' then raise exception 'validation:delivery_location'; end if;

  for it in select * from jsonb_array_elements(payload->'items') loop
    if coalesce(length(trim(it->>'description')),0) < 2 or (it->>'quantity')::int < 1 or (it->>'weight')::numeric <= 0 then
      raise exception 'validation:items';
    end if;
    v_tons := v_tons + case when it->>'weight_unit' = 'kg' then (it->>'weight')::numeric / 1000 else (it->>'weight')::numeric end;
    if (it->>'category') in ('car','motorcycle','truck','heavy_machinery') then v_veh := v_veh + (it->>'quantity')::int; end if;
  end loop;

  select * into s from sailing_schedules where id = payload->>'schedule_id' for share;
  if not found or s.status <> 'open' or s.route_id <> payload->>'route_id' then raise exception 'business:schedule_unavailable'; end if;
  if s.depart_at < now() then raise exception 'business:schedule_unavailable'; end if;
  if s.booked_tons + v_tons > s.capacity_tons then raise exception 'business:capacity'; end if;
  if v_veh > 0 and s.booked_vehicles + v_veh > s.vehicle_slots then raise exception 'business:vehicle_capacity'; end if;

  select rate_per_ton into v_rate from routes where id = s.route_id;
  v_ref := public.gen_ref('C');
  insert into cargo_bookings (ref, customer_id, schedule_id, route_id, ship_date, transport_mode, contact,
      pickup_location, delivery_location, total_tons, total_vehicles, estimated_price)
  values (v_ref, auth.uid(), s.id, s.route_id, (s.depart_at at time zone 'Asia/Bangkok')::date, v_mode, v_contact,
      nullif(trim(payload->>'pickup_location'),''), nullif(trim(payload->>'delivery_location'),''), v_tons, v_veh,
      case when v_rate is not null then round(v_rate * v_tons, 2) end)
  returning id into v_id;

  insert into cargo_items (booking_id, category, description, quantity, weight, weight_unit, length_m, width_m, height_m, vehicle_reg, special)
  select v_id, (e->>'category')::cargo_category, trim(e->>'description'), (e->>'quantity')::int, (e->>'weight')::numeric, e->>'weight_unit',
         nullif(e->>'length_m','')::numeric, nullif(e->>'width_m','')::numeric, nullif(e->>'height_m','')::numeric,
         nullif(e->>'vehicle_reg',''), nullif(e->>'special','')
  from jsonb_array_elements(payload->'items') e;

  insert into documents (owner_id, entity_type, entity_ref, path)
  select auth.uid(), 'cargo', v_ref, f from jsonb_array_elements_text(coalesce(payload->'files','[]')) f;

  perform public.log_status('cargo', v_id, 'pending_review', 'Submitted online');
  perform public.push_notification('admin', null, 'มีคำขอจองเรือใหม่', 'New cargo booking request', v_ref, '/admin/#bookings');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำขอจองเรือแล้ว', 'Booking request received', v_ref);
  perform public.write_audit('create', 'cargo_booking', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'estimated_price', case when v_rate is not null then round(v_rate * v_tons, 2) end);
end $$;

-- ───────── Cargo booking (staff): transaction-safe confirmation ─────────
create or replace function public.confirm_cargo_booking(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b cargo_bookings%rowtype; s sailing_schedules%rowtype;
begin
  perform public.require_staff();
  select * into b from cargo_bookings where id = p_id for update;
  if not found then raise exception 'business:not_found'; end if;
  if b.status not in ('pending_review','awaiting_quotation','awaiting_payment') or b.capacity_held then raise exception 'business:state'; end if;
  -- lock the sailing row so concurrent confirmations serialise
  select * into s from sailing_schedules where id = b.schedule_id for update;
  if not found or s.status in ('cancelled','closed') then raise exception 'business:schedule'; end if;
  if s.booked_tons + b.total_tons > s.capacity_tons then raise exception 'business:capacity'; end if;
  if s.booked_vehicles + b.total_vehicles > s.vehicle_slots then raise exception 'business:vehicle_capacity'; end if;

  update sailing_schedules
     set booked_tons = booked_tons + b.total_tons,
         booked_vehicles = booked_vehicles + b.total_vehicles,
         status = case when booked_tons + b.total_tons >= capacity_tons then 'full' else status end
   where id = s.id;
  update cargo_bookings set status = 'confirmed', capacity_held = true, updated_at = now() where id = p_id;
  perform public.log_status('cargo', p_id, 'confirmed');
  perform public.push_notification('customer', b.contact_phone, 'การจองเรือของคุณได้รับการยืนยันแล้ว', 'Your cargo booking is confirmed', b.ref);
  perform public.write_audit('confirm', 'cargo_booking', b.ref);
end $$;

create or replace function public.set_cargo_status(p_id uuid, p_status booking_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b cargo_bookings%rowtype;
begin
  perform public.require_staff();
  if p_status = 'confirmed' then perform public.confirm_cargo_booking(p_id); return; end if;
  select * into b from cargo_bookings where id = p_id for update;
  if not found then raise exception 'business:not_found'; end if;
  if p_status in ('cargo_received','loading','in_transit','arrived','delivered') and not b.capacity_held and b.status <> 'arrived' then
    raise exception 'business:state';
  end if;
  if p_status = 'cancelled' and b.capacity_held then
    update sailing_schedules
       set booked_tons = greatest(0, booked_tons - b.total_tons),
           booked_vehicles = greatest(0, booked_vehicles - b.total_vehicles),
           status = case when status = 'full' then 'open' else status end
     where id = b.schedule_id;
  end if;
  update cargo_bookings
     set status = p_status,
         capacity_held = case when p_status in ('cancelled','delivered') then false else capacity_held end,
         updated_at = now()
   where id = p_id;
  perform public.log_status('cargo', p_id, p_status::text, p_note);
  perform public.push_notification('customer', b.contact_phone, 'อัปเดตสถานะการจองเรือ', 'Cargo booking status updated', b.ref);
  perform public.write_audit('status:' || p_status, 'cargo_booking', b.ref);
end $$;

-- ───────── Construction / machinery / orders / quote requests ─────────
create or replace function public.submit_construction_request(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_contact jsonb := public.clean_contact(payload->'contact'); v_id uuid; v_ref text := public.gen_ref('K');
  v_type construction_service := (payload->>'project_type')::construction_service;
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if coalesce(((select data from site_settings where id = 1)->'construction_services'->>v_type::text)::boolean, true) is not true then raise exception 'business:service_disabled'; end if;
  if coalesce(length(trim(payload->>'location')),0) < 3 then raise exception 'validation:location'; end if;
  if coalesce(length(trim(payload->>'description')),0) < 10 then raise exception 'validation:description'; end if;
  insert into construction_requests (ref, customer_id, project_type, location, project_size, land_size, budget, start_date, end_date, inspection_date, description, contact)
  values (v_ref, auth.uid(), v_type, trim(payload->>'location'), payload->>'project_size', payload->>'land_size', payload->>'budget',
          nullif(payload->>'start_date','')::date, nullif(payload->>'end_date','')::date, nullif(payload->>'inspection_date','')::date,
          trim(payload->>'description'), v_contact)
  returning id into v_id;
  insert into documents (owner_id, entity_type, entity_ref, path)
  select auth.uid(), 'construction', v_ref, f from jsonb_array_elements_text(coalesce(payload->'files','[]')) f;
  perform public.log_status('construction', v_id, 'submitted');
  perform public.push_notification('admin', null, 'มีคำขอใบเสนอราคางานก่อสร้างใหม่', 'New construction request', v_ref, '/admin/#construction');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำของานก่อสร้างแล้ว', 'Construction request received', v_ref);
  perform public.write_audit('create', 'construction_request', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

create or replace function public.set_construction_status(p_id uuid, p_status construction_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c construction_requests%rowtype;
begin
  perform public.require_staff();
  update construction_requests set status = p_status where id = p_id returning * into c;
  perform public.log_status('construction', p_id, p_status::text, p_note);
  perform public.push_notification('customer', c.contact_phone, 'อัปเดตสถานะคำของานก่อสร้าง', 'Construction request updated', c.ref);
  perform public.write_audit('status:' || p_status, 'construction_request', c.ref);
end $$;

create or replace function public.submit_machinery_booking(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_contact jsonb := public.clean_contact(payload->'contact'); v_id uuid; v_ref text := public.gen_ref('M');
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if coalesce(length(trim(payload->>'location')),0) < 3 then raise exception 'validation:location'; end if;
  if (payload->>'start_date')::date < (now() at time zone 'Asia/Bangkok')::date then raise exception 'validation:start_date'; end if;
  insert into machinery_bookings (ref, customer_id, machinery_type, capacity, location, start_date, duration, rate_unit, operator, description, contact)
  values (v_ref, auth.uid(), (payload->>'machinery_type')::machinery_type, payload->>'capacity', trim(payload->>'location'),
          (payload->>'start_date')::date, (payload->>'duration')::int, payload->>'rate_unit', coalesce((payload->>'operator')::boolean,false),
          trim(payload->>'description'), v_contact)
  returning id into v_id;
  insert into documents (owner_id, entity_type, entity_ref, path)
  select auth.uid(), 'machinery', v_ref, f from jsonb_array_elements_text(coalesce(payload->'files','[]')) f;
  perform public.log_status('machinery', v_id, 'pending_review');
  perform public.push_notification('admin', null, 'มีคำขอเช่าเครื่องจักรใหม่', 'New machinery request', v_ref, '/admin/#machinery');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำขอเช่าเครื่องจักรแล้ว', 'Machinery request received', v_ref);
  perform public.write_audit('create', 'machinery_booking', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

-- Overlaps are rejected by the exclusion constraint machinery_bookings_no_overlap.
create or replace function public.set_machinery_status(p_id uuid, p_status machinery_booking_status, p_machinery_id text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m machinery_bookings%rowtype;
begin
  perform public.require_staff();
  if p_status = 'confirmed' then
    if p_machinery_id is null then raise exception 'business:assign'; end if;
    if not exists (select 1 from machinery where id = p_machinery_id and status = 'available') then raise exception 'business:unavailable'; end if;
  end if;
  begin
    update machinery_bookings set status = p_status, machinery_id = coalesce(p_machinery_id, machinery_id) where id = p_id returning * into m;
  exception when exclusion_violation then
    raise exception 'business:overlap';
  end;
  perform public.log_status('machinery', p_id, p_status::text, p_note);
  perform public.push_notification('customer', m.contact_phone, 'อัปเดตสถานะการเช่าเครื่องจักร', 'Machinery booking updated', m.ref);
  perform public.write_audit('status:' || p_status, 'machinery_booking', m.ref);
end $$;

create or replace function public.submit_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_contact jsonb := public.clean_contact(payload->'contact'); v_id uuid; v_ref text := public.gen_ref('O');
  l jsonb; p products%rowtype; v_sub numeric := 0; v_all_priced boolean := true;
begin
  if coalesce((payload->>'accept_terms')::boolean, false) is not true then raise exception 'validation:accept_terms'; end if;
  if jsonb_array_length(coalesce(payload->'lines','[]')) = 0 then raise exception 'validation:lines'; end if;
  if coalesce(length(trim(payload->>'delivery_location')),0) < 3 then raise exception 'validation:delivery_location'; end if;
  insert into orders (ref, customer_id, delivery_location, with_transport, route_id, notes, contact)
  values (v_ref, auth.uid(), trim(payload->>'delivery_location'), coalesce((payload->>'with_transport')::boolean,false),
          nullif(payload->>'route_id',''), payload->>'notes', v_contact)
  returning id into v_id;
  for l in select * from jsonb_array_elements(payload->'lines') loop
    select * into p from products where id = l->>'product_id' and active;
    if not found then raise exception 'business:product'; end if;
    if (l->>'qty')::numeric <= 0 then raise exception 'validation:qty'; end if;
    if p.stock is not null and (l->>'qty')::numeric > p.stock then raise exception 'business:stock'; end if;
    insert into order_items (order_id, product_id, name, unit, qty, unit_price) values (v_id, p.id, p.name_th, p.unit_th, (l->>'qty')::numeric, p.price);
    if p.price is null then v_all_priced := false; else v_sub := v_sub + p.price * (l->>'qty')::numeric; end if;
  end loop;
  -- subtotal only when every line has a verified price; never invented
  update orders set subtotal = case when v_all_priced then v_sub end where id = v_id;
  perform public.log_status('order', v_id, 'quotation_requested');
  perform public.push_notification('admin', null, 'มีคำสั่งซื้อ/ขอราคาวัสดุใหม่', 'New materials order request', v_ref, '/admin/#orders');
  perform public.push_notification('customer', v_contact->>'phone', 'ได้รับคำขอสั่งซื้อวัสดุแล้ว', 'Materials order received', v_ref);
  perform public.write_audit('create', 'order', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'subtotal', case when v_all_priced then v_sub end);
end $$;

create or replace function public.set_order_status(p_id uuid, p_status order_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform public.require_staff();
  select * into o from orders where id = p_id for update;
  if p_status = 'confirmed' and o.status <> 'confirmed' then
    -- decrement tracked inventory atomically; fails if stock would go negative (check constraint)
    update products p set stock = p.stock - oi.qty, updated_at = now()
      from order_items oi where oi.order_id = p_id and oi.product_id = p.id and p.stock is not null;
  end if;
  update orders set status = p_status where id = p_id;
  perform public.log_status('order', p_id, p_status::text, p_note);
  perform public.push_notification('customer', o.contact_phone, 'อัปเดตสถานะคำสั่งซื้อวัสดุ', 'Materials order updated', o.ref);
  perform public.write_audit('status:' || p_status, 'order', o.ref);
end $$;

create or replace function public.submit_quote_request(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_contact jsonb := public.clean_contact(payload->'contact'); v_ref text := public.gen_ref('Q');
begin
  if coalesce(length(trim(payload->>'message')),0) < 5 then raise exception 'validation:message'; end if;
  insert into quote_requests (ref, service, message, contact) values (v_ref, payload->>'service', trim(payload->>'message'), v_contact);
  perform public.push_notification('admin', null, 'คำขอใบเสนอราคา: ' || (payload->>'service'), 'Quotation request: ' || (payload->>'service'),
    v_ref || ' · ' || (v_contact->>'full_name') || ' · ' || (v_contact->>'phone'));
  return jsonb_build_object('ref', v_ref);
end $$;

-- ───────── Tracking: reference + phone must both match ─────────
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
    select jsonb_build_object('kind','order','id',id,'ref',ref,'status',status,'payment_status',payment_status,'created_at',created_at,
             'service_label_th','สั่งซื้อวัสดุก่อสร้าง','service_label_en','Materials order')
      into res from orders where ref = r and contact_phone = ph;
  end if;
  if res is null then return null; end if;
  return res || jsonb_build_object('history', coalesce((
    select jsonb_agg(jsonb_build_object('status', status, 'at', at, 'note', note) order by at)
      from booking_status_history where entity_type = (res->>'kind')::quotation_kind and entity_id = (res->>'id')::uuid), '[]'::jsonb));
end $$;

-- ───────── Quotations ─────────
create or replace function public.create_quotation(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ref text := public.gen_ref('Q'); v_kind quotation_kind := (payload->>'kind')::quotation_kind; v_phone text := public.norm_phone(payload->>'customer_phone');
begin
  perform public.require_staff();
  if jsonb_array_length(coalesce(payload->'items','[]')) = 0 then raise exception 'validation:items'; end if;
  insert into quotations (ref, kind, target_ref, customer_phone, customer_id, vat_rate, deposit_percent, notes, valid_until, status, created_by)
  values (v_ref, v_kind, payload->>'target_ref', v_phone, (select id from profiles where phone = v_phone limit 1),
          coalesce((payload->>'vat_rate')::numeric, 7), nullif(payload->>'deposit_percent','')::numeric, payload->>'notes',
          nullif(payload->>'valid_until','')::date, 'sent', auth.uid())
  returning id into v_id;
  insert into quotation_items (quotation_id, description, qty, unit, unit_price, sort)
  select v_id, e->>'description', (e->>'qty')::numeric, coalesce(e->>'unit',''), (e->>'unit_price')::numeric, (ord - 1)::int
    from jsonb_array_elements(payload->'items') with ordinality as t(e, ord);
  if v_kind = 'cargo' then
    update cargo_bookings set status = 'awaiting_quotation' where ref = payload->>'target_ref' and status = 'pending_review';
  elsif v_kind = 'construction' then
    update construction_requests set status = 'quotation_sent' where ref = payload->>'target_ref';
  elsif v_kind = 'machinery' then
    update machinery_bookings set status = 'awaiting_quotation' where ref = payload->>'target_ref' and status = 'pending_review';
  else
    update orders set status = 'quoted' where ref = payload->>'target_ref';
  end if;
  perform public.push_notification('customer', v_phone, 'คุณได้รับใบเสนอราคาใหม่', 'You have a new quotation', v_ref || ' → ' || (payload->>'target_ref'), '/account/');
  perform public.write_audit('create', 'quotation', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

create or replace function public.respond_quotation(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare q quotations%rowtype; v_total numeric;
begin
  select * into q from quotations where id = p_id for update;
  if not found or q.status <> 'sent' then raise exception 'business:quotation'; end if;
  if not (q.customer_id = auth.uid() or q.customer_phone = public.my_phone()) then raise exception 'forbidden' using errcode = '42501'; end if;
  select round(sum(qty * unit_price) * (1 + q.vat_rate / 100), 2) into v_total from quotation_items where quotation_id = p_id;
  update quotations set status = case when p_accept then 'accepted'::quotation_status else 'rejected'::quotation_status end where id = p_id;
  if q.kind = 'cargo' and p_accept then
    update cargo_bookings set price = v_total, status = case when status in ('pending_review','awaiting_quotation') then 'awaiting_payment' else status end where ref = q.target_ref;
  elsif q.kind = 'construction' then
    update construction_requests set status = case when p_accept then 'accepted'::construction_status else 'rejected'::construction_status end where ref = q.target_ref;
  elsif q.kind = 'order' then
    update orders set status = case when p_accept then 'awaiting_payment'::order_status else 'cancelled'::order_status end,
                      subtotal = case when p_accept then v_total else subtotal end where ref = q.target_ref;
  end if;
  perform public.push_notification('admin', null, case when p_accept then 'ลูกค้ายอมรับใบเสนอราคา' else 'ลูกค้าปฏิเสธใบเสนอราคา' end,
    case when p_accept then 'Customer accepted quotation' else 'Customer rejected quotation' end, q.ref);
  perform public.write_audit(case when p_accept then 'accept' else 'reject' end, 'quotation', q.ref);
end $$;

-- ───────── Payments (slip upload + admin verification; never auto-confirmed) ─────────
create or replace function public.submit_payment(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ref text := public.gen_ref('P'); v_id uuid; v_phone text := public.norm_phone(payload->>'customer_phone');
begin
  if (payload->>'amount')::numeric <= 0 then raise exception 'validation:amount'; end if;
  if coalesce(payload->>'slip_path','') = '' then raise exception 'validation:slip'; end if;
  insert into payments (ref, target_kind, target_ref, customer_phone, customer_id, amount, payment_type, method, slip_path)
  values (v_ref, (payload->>'target_kind')::quotation_kind, payload->>'target_ref', v_phone, auth.uid(),
          (payload->>'amount')::numeric, payload->>'payment_type', payload->>'method', payload->>'slip_path')
  returning id into v_id;
  if payload->>'target_kind' = 'cargo' then update cargo_bookings set payment_status = 'pending_verification' where ref = payload->>'target_ref' and contact_phone = v_phone;
  elsif payload->>'target_kind' = 'order' then update orders set payment_status = 'pending_verification' where ref = payload->>'target_ref' and contact_phone = v_phone;
  end if;
  perform public.push_notification('admin', null, 'มีสลิปการชำระเงินรอตรวจสอบ', 'Payment slip awaiting verification', v_ref || ' → ' || (payload->>'target_ref'), '/admin/#finance');
  perform public.write_audit('create', 'payment', v_ref);
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

create or replace function public.verify_payment(p_id uuid, p_ok boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype; v_new payment_status;
begin
  perform public.require_staff();
  update payments set status = case when p_ok then 'verified'::payment_verify_status else 'rejected'::payment_verify_status end,
                      note = p_note, verified_by = auth.uid(), verified_at = now()
   where id = p_id returning * into p;
  v_new := case when not p_ok then 'unpaid' when p.payment_type = 'deposit' then 'deposit_paid' else 'paid' end;
  if p.target_kind = 'cargo' then update cargo_bookings set payment_status = v_new where ref = p.target_ref;
  elsif p.target_kind = 'order' then
    update orders set payment_status = v_new, status = case when p_ok and status = 'awaiting_payment' then 'confirmed' else status end where ref = p.target_ref;
  end if;
  perform public.push_notification('customer', p.customer_phone,
    case when p_ok then 'ยืนยันการชำระเงินแล้ว' else 'สลิปการชำระเงินไม่ผ่านการตรวจสอบ' end,
    case when p_ok then 'Payment verified' else 'Payment slip rejected' end, p.ref || ' ' || coalesce(p_note,''));
  perform public.write_audit(case when p_ok then 'verify' else 'reject' end, 'payment', p.ref);
end $$;

-- ───────── Grants ─────────
revoke all on function public.confirm_cargo_booking(uuid), public.set_cargo_status(uuid, booking_status, text),
  public.set_construction_status(uuid, construction_status, text), public.set_machinery_status(uuid, machinery_booking_status, text, text),
  public.set_order_status(uuid, order_status, text), public.create_quotation(jsonb), public.verify_payment(uuid, boolean, text) from anon;
grant execute on function public.submit_cargo_booking(jsonb), public.submit_construction_request(jsonb), public.submit_machinery_booking(jsonb),
  public.submit_order(jsonb), public.submit_quote_request(jsonb), public.track_booking(text, text), public.submit_payment(jsonb) to anon, authenticated;
grant execute on function public.respond_quotation(uuid, boolean) to authenticated;
-- internal helpers are not callable by clients
revoke execute on function public.push_notification(text, text, text, text, text, text), public.log_status(quotation_kind, uuid, text, text),
  public.write_audit(text, text, text) from anon, authenticated, public;
