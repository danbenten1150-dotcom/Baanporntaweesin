-- ════════════════════════════════════════════════════════════════════
-- Role-based access control + row-level security + storage
-- Customers see only their own rows. Staff/admin see everything.
-- Anonymous visitors can READ public catalogue data only; they SUBMIT
-- requests exclusively through SECURITY DEFINER functions (see 0003).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.current_role_name() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'customer'::app_role)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','admin'))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.my_phone() returns text
language sql stable security definer set search_path = public as $$
  select phone from profiles where id = auth.uid()
$$;

-- Auto-create a profile for every new auth user (always role = customer)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, phone, pdpa_consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''),
    case when (new.raw_user_meta_data->>'pdpa_consent') = 'true' then now() end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Customers may not promote themselves
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for the service role / SQL editor (trusted bootstrap of the first admin)
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect_role before update on profiles
for each row execute function public.protect_profile_role();

-- ───────── Enable RLS everywhere ─────────
do $$
declare t text;
begin
  foreach t in array array[
    'companies','profiles','customer_addresses','ports','routes','vessels','sailing_schedules',
    'cargo_bookings','cargo_items','booking_status_history','construction_requests','machinery',
    'machinery_bookings','product_categories','products','orders','order_items','quotations',
    'quotation_items','payments','documents','notifications','audit_logs','quote_requests','site_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Public catalogue (read-only for everyone)
create policy public_read on ports for select using (true);
create policy public_read on routes for select using (active or public.is_staff());
create policy public_read on vessels for select using (status <> 'inactive');
create policy public_read on sailing_schedules for select using (status <> 'cancelled' or public.is_staff());
create policy public_read on product_categories for select using (true);
create policy public_read on products for select using (active);
create policy public_read on machinery for select using (status <> 'inactive');
create policy public_read on site_settings for select using (true);

-- Profiles / companies / addresses: owner only
create policy own_profile_select on profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_company on companies for all to authenticated
  using (created_by = auth.uid() or id = (select company_id from profiles where id = auth.uid()))
  with check (created_by = auth.uid());
create policy own_addresses on customer_addresses for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Customer-owned records (by account, or by verified phone on the account)
create policy own_rows on cargo_bookings for select to authenticated
  using (customer_id = auth.uid() or (contact_phone is not null and contact_phone = public.my_phone()));
create policy own_rows on cargo_items for select to authenticated
  using (exists (select 1 from cargo_bookings b where b.id = booking_id and (b.customer_id = auth.uid() or b.contact_phone = public.my_phone())));
create policy own_rows on construction_requests for select to authenticated
  using (customer_id = auth.uid() or contact_phone = public.my_phone());
create policy own_rows on machinery_bookings for select to authenticated
  using (customer_id = auth.uid() or contact_phone = public.my_phone());
create policy own_rows on orders for select to authenticated
  using (customer_id = auth.uid() or contact_phone = public.my_phone());
create policy own_rows on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.contact_phone = public.my_phone())));
create policy own_rows on quotations for select to authenticated
  using (status <> 'draft' and (customer_id = auth.uid() or customer_phone = public.my_phone()));
create policy own_rows on quotation_items for select to authenticated
  using (exists (select 1 from quotations q where q.id = quotation_id and q.status <> 'draft' and (q.customer_id = auth.uid() or q.customer_phone = public.my_phone())));
create policy own_rows on payments for select to authenticated
  using (customer_id = auth.uid() or customer_phone = public.my_phone());
create policy own_rows on documents for select to authenticated using (owner_id = auth.uid());
create policy own_rows on notifications for select to authenticated
  using (audience = 'customer' and (customer_id = auth.uid() or customer_phone = public.my_phone()));
create policy own_rows_update on notifications for update to authenticated
  using (audience = 'customer' and (customer_id = auth.uid() or customer_phone = public.my_phone()))
  with check (audience = 'customer');
create policy own_rows on booking_status_history for select to authenticated using (
  (entity_type = 'cargo' and exists (select 1 from cargo_bookings b where b.id = entity_id and (b.customer_id = auth.uid() or b.contact_phone = public.my_phone())))
  or (entity_type = 'construction' and exists (select 1 from construction_requests c where c.id = entity_id and (c.customer_id = auth.uid() or c.contact_phone = public.my_phone())))
  or (entity_type = 'machinery' and exists (select 1 from machinery_bookings m where m.id = entity_id and (m.customer_id = auth.uid() or m.contact_phone = public.my_phone())))
  or (entity_type = 'order' and exists (select 1 from orders o where o.id = entity_id and (o.customer_id = auth.uid() or o.contact_phone = public.my_phone())))
);

-- Only admins may delete or touch settings/audit beyond staff_all
create policy admin_only_settings on site_settings as restrictive for update to authenticated using (public.is_admin());

-- Internal notes never leave staff: expose a customer-safe view
create view public.cargo_bookings_customer with (security_invoker = true) as
  select id, ref, customer_id, schedule_id, route_id, ship_date, transport_mode, contact, pickup_location,
         delivery_location, total_tons, total_vehicles, status, payment_status, price, estimated_price, created_at
  from cargo_bookings;

-- ───────── Storage (private buckets; access via signed URLs) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('site-media', 'site-media', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Anyone (incl. guests) may upload into documents/incoming/<random uuid>/..., never read it back.
create policy docs_upload_incoming on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'incoming');
-- Signed-in customers may read files inside their own folder documents/users/<uid>/...
create policy docs_own_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text);
create policy docs_own_write on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text);
create policy docs_staff on storage.objects for all to authenticated
  using (bucket_id in ('documents','site-media') and public.is_staff())
  with check (bucket_id in ('documents','site-media') and public.is_staff());
create policy media_public_read on storage.objects for select using (bucket_id = 'site-media');
