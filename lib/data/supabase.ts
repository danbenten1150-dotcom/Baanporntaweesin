'use client';

// Production adapter. All customer writes go through SECURITY DEFINER Postgres functions
// (supabase/migrations/…_functions.sql) which validate input, enforce capacity with row
// locks and write status history, notifications and audit logs in one transaction.
// Reads rely on row-level security: customers only ever receive their own rows.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BookingStatus, CargoBooking, Collection, ConstructionRequest, ConstructionStatus, MachineryBooking,
  MachineryBookingStatus, Order, OrderStatus, Payment, Quotation, Settings, SleeperBooking, SleeperStatus, StatusEvent, Store, TrackResult, UserProfile,
} from '../types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { defaultSettings } from './seed';
import { emitChange, type CustomerBundle, type DataApi } from './api';
import {
  BusinessError, ValidationError, cargoBookingSchema, constructionSchema, flattenErrors, machinerySchema, orderSchema, quoteRequestSchema, sleeperSchema,
} from '../validation';
import { normalizePhone, uid } from '../utils';
import type { z } from 'zod';

// The Supabase library is loaded on first use only, so pages stay light (and demo mode never downloads it).
let client: Promise<SupabaseClient> | null = null;
export function supabase(): Promise<SupabaseClient> {
  if (!client) client = import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }));
  return client;
}

const BUSINESS_TEXT: Record<string, [string, string]> = {
  capacity: ['พื้นที่บรรทุกในรอบเรือนี้ไม่เพียงพอ', 'Not enough capacity on this sailing.'],
  vehicle_capacity: ['ช่องยานพาหนะบนเรือรอบนี้ไม่เพียงพอ', 'Not enough vehicle slots on this sailing.'],
  schedule_unavailable: ['รอบเรือนี้ไม่เปิดรับจองแล้ว', 'This sailing is no longer open.'],
  schedule: ['รอบเรือถูกยกเลิก/ปิดแล้ว', 'Sailing is closed or cancelled.'],
  state: ['สถานะปัจจุบันไม่สามารถดำเนินการนี้ได้', 'Not allowed from the current status.'],
  overlap: ['ช่วงเวลาซ้อนกับการจองเครื่องจักรที่ยืนยันแล้ว', 'Overlaps a confirmed machinery booking.'],
  assign: ['กรุณาเลือกเครื่องจักร', 'Assign a machine first.'],
  unavailable: ['เครื่องจักรไม่พร้อมใช้งาน', 'Machine not available.'],
  stock: ['จำนวนสินค้าคงเหลือไม่พอ', 'Insufficient stock.'],
  product: ['มีสินค้าที่ไม่พร้อมจำหน่าย', 'A product is unavailable.'],
  quotation: ['ใบเสนอราคานี้ไม่สามารถตอบรับได้', 'This quotation cannot be answered.'],
  mode_disabled: ['รูปแบบการขนส่งนี้ยังไม่เปิดให้บริการ', 'Transport option not available.'],
  service_disabled: ['บริการนี้ยังไม่เปิดให้บริการ', 'Service not offered.'],
  not_found: ['ไม่พบข้อมูล', 'Not found.'],
  sleeper_closed: ['ขณะนี้ยังไม่เปิดรับจองตั๋วเรือนอน', 'Sleeper-boat booking is not open right now.'],
  no_sailing: ['วันที่เลือกไม่มีเรือนอนออก กรุณาเลือกวันอื่น', 'No sleeper boat on that date — please pick another day.'],
  berths: ['ที่นอนในรอบนี้ไม่พอ กรุณาเลือกวันอื่นหรือลดจำนวนผู้โดยสาร', 'Not enough berths on this sailing.'],
  needs_details: ['ต้องระบุรอบเรือและน้ำหนักให้ครบก่อนยืนยัน', 'Assign a sailing and fill in all weights first.'],
};

function fail(error: { message: string; code?: string } | null): never | void {
  if (!error) return;
  const m = error.message || '';
  if (m.startsWith('validation:')) throw new ValidationError({ [m.slice(11)]: 'required' });
  if (m.startsWith('business:')) {
    const code = m.slice(9);
    const [th, en] = BUSINESS_TEXT[code] || ['ไม่สามารถดำเนินการได้', 'Request could not be completed.'];
    throw new BusinessError(code, th, en);
  }
  if (error.code === '42501' || m === 'forbidden') throw new BusinessError('forbidden', 'ไม่มีสิทธิ์ดำเนินการ', 'Not authorised.');
  throw new BusinessError('server', 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'Something went wrong. Please try again.');
}

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(flattenErrors(r.error));
  return r.data;
}

const TABLE: Record<Collection, string> = {
  ports: 'ports', routes: 'routes', vessels: 'vessels', schedules: 'sailing_schedules', cargo: 'cargo_bookings',
  construction: 'construction_requests', machinery: 'machinery', machineryBookings: 'machinery_bookings', sleeperBookings: 'sleeper_bookings',
  categories: 'product_categories', products: 'products', orders: 'orders', quotations: 'quotations', payments: 'payments',
  notifications: 'notifications', audit: 'audit_logs', users: 'profiles',
};

type Row = Record<string, unknown>;
const historyFor = (rows: Row[], kind: string, id: string): StatusEvent[] =>
  rows.filter((h) => h.entity_type === kind && h.entity_id === id).map((h) => ({ status: String(h.status), at: String(h.at), note: (h.note as string) || undefined }));

let realtimeStarted = false;
/** Subscribes once to database changes; RLS still decides which rows each user receives. */
export function startRealtime() {
  if (realtimeStarted || typeof window === 'undefined') return;
  realtimeStarted = true;
  supabase().then((db) => {
    const ch = db.channel('bpt-live');
    for (const table of ['cargo_bookings', 'construction_requests', 'machinery_bookings', 'sleeper_bookings', 'orders', 'payments', 'notifications'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => emitChange());
    ch.subscribe();
  });
}

export class SupabaseApi implements DataApi {
  readonly mode = 'supabase' as const;
  private db!: SupabaseClient;
  private async c() { if (!this.db) this.db = await supabase(); return this.db; }

  async uploadFiles(files: File[], folder: string) {
    await this.c();
    // Public website media (vessel/product/banner photos) → public bucket, returns public URLs. Staff only (RLS).
    if (folder === 'vessels' || folder === 'products' || folder === 'site') {
      const out: string[] = [];
      for (const f of files) {
        const path = `${folder}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
        const { error } = await this.db.storage.from('site-media').upload(path, f, { contentType: f.type });
        fail(error);
        out.push(this.db.storage.from('site-media').getPublicUrl(path).data.publicUrl);
      }
      return out;
    }
    const { data: { user } } = await this.db.auth.getUser();
    const base = user ? `users/${user.id}/${folder}` : `incoming/${uid()}/${folder}`;
    const out: string[] = [];
    for (const f of files) {
      const path = `${base}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await this.db.storage.from('documents').upload(path, f, { upsert: false, contentType: f.type });
      fail(error);
      out.push(path);
    }
    return out;
  }

  async getSettings(): Promise<Settings> {
    await this.c();
    const { data } = await this.db.from('site_settings').select('data').eq('id', 1).maybeSingle();
    return { ...defaultSettings(), ...((data?.data as Partial<Settings>) || {}) };
  }

  /** Public catalogue for everyone; operational tables are filled only when RLS allows (staff). */
  async getStore(): Promise<Store> {
    await this.c();
    const q = (t: string, order?: string) => {
      const b = this.db.from(t).select('*');
      return (order ? b.order(order, { ascending: order !== 'created_at' }) : b).then((r) => (r.data || []) as Row[]);
    };
    const [settings, ports, routes, vessels, schedules, categories, products, machinery, cargo, items, history,
      construction, mBookings, orders, orderItems, quotations, qItems, payments, notifications, audit, users] = await Promise.all([
      this.getSettings(), q('ports'), q('routes'), q('vessels'), q('sailing_schedules', 'depart_at'), q('product_categories', 'sort'),
      q('products'), q('machinery'), q('cargo_bookings', 'created_at'), q('cargo_items'), q('booking_status_history', 'at'),
      q('construction_requests', 'created_at'), q('machinery_bookings', 'created_at'), q('orders', 'created_at'), q('order_items'),
      q('quotations', 'created_at'), q('quotation_items', 'sort'), q('payments', 'created_at'), q('notifications', 'created_at'),
      q('audit_logs', 'at'), q('profiles'),
    ]);
    const sleeper = await q('sleeper_bookings', 'created_at');
    return {
      settings,
      ports: ports as unknown as Store['ports'], routes: routes as unknown as Store['routes'],
      vessels: vessels as unknown as Store['vessels'], schedules: schedules as unknown as Store['schedules'],
      categories: categories as unknown as Store['categories'], products: products as unknown as Store['products'],
      machinery: machinery as unknown as Store['machinery'],
      cargo: cargo.map((b) => ({ ...b, files: [], items: items.filter((i) => i.booking_id === b.id), history: historyFor(history, 'cargo', String(b.id)) })) as unknown as CargoBooking[],

      construction: construction.map((c) => ({ ...c, files: [], history: historyFor(history, 'construction', String(c.id)) })) as unknown as ConstructionRequest[],
      machineryBookings: mBookings.map((m) => ({ ...m, files: [], history: historyFor(history, 'machinery', String(m.id)) })) as unknown as MachineryBooking[],
      sleeperBookings: sleeper.map((b) => ({ ...b, history: historyFor(history, 'sleeper', String(b.id)) })) as unknown as SleeperBooking[],
      orders: orders.map((o) => ({ ...o, items: orderItems.filter((i) => i.order_id === o.id), history: historyFor(history, 'order', String(o.id)) })) as unknown as Order[],
      quotations: quotations.map((x) => ({ ...x, items: qItems.filter((i) => i.quotation_id === x.id) })) as unknown as Quotation[],
      payments: payments.map((p) => ({ ...p, slip_name: p.slip_path })) as unknown as Payment[],
      notifications: notifications as unknown as Store['notifications'],
      audit: audit.map((a) => ({ ...a, id: String(a.id) })) as unknown as Store['audit'],
      users: users.map((u) => ({ ...u, addresses: [] })) as unknown as UserProfile[],
    };
  }

  private async rpc<T = Row>(fn: string, args: Row): Promise<T> {
    await this.c();
    const { data, error } = await this.db.rpc(fn, args);
    fail(error);
    emitChange();
    return data as T;
  }

  async createCargoBooking(input: Parameters<DataApi['createCargoBooking']>[0]) {
    await this.c();
    const v = validate(cargoBookingSchema, input);
    const r = await this.rpc<{ id: string; ref: string; estimated_price: number | null }>('submit_cargo_booking', { payload: v });
    return { ...(v as unknown as CargoBooking), id: r.id, ref: r.ref, status: 'pending_review', payment_status: 'unpaid', price: null, estimated_price: r.estimated_price, history: [{ status: 'pending_review', at: new Date().toISOString() }], created_at: new Date().toISOString() } as CargoBooking;
  }
  async createConstructionRequest(input: Parameters<DataApi['createConstructionRequest']>[0]) {
    await this.c();
    const v = validate(constructionSchema, input);
    const r = await this.rpc<{ id: string; ref: string }>('submit_construction_request', { payload: v });
    return { ...(v as unknown as ConstructionRequest), id: r.id, ref: r.ref, status: 'submitted', progress: 0, history: [], created_at: new Date().toISOString() } as ConstructionRequest;
  }
  async createMachineryBooking(input: Parameters<DataApi['createMachineryBooking']>[0]) {
    await this.c();
    const v = validate(machinerySchema, input);
    const r = await this.rpc<{ id: string; ref: string }>('submit_machinery_booking', { payload: v });
    return { ...(v as unknown as MachineryBooking), id: r.id, ref: r.ref, status: 'pending_review', history: [], created_at: new Date().toISOString() } as MachineryBooking;
  }
  async createSleeperBooking(input: Parameters<DataApi['createSleeperBooking']>[0]) {
    await this.c();
    const v = validate(sleeperSchema, input);
    const r = await this.rpc<{ id: string; ref: string }>('submit_sleeper_booking', { payload: v });
    return { ...(v as unknown as SleeperBooking), id: r.id, ref: r.ref, seats: v.passengers.length, status: 'pending_review', price: null, history: [], created_at: new Date().toISOString() } as SleeperBooking;
  }
  async sleeperTaken(direction: SleeperBooking['direction']) {
    await this.c();
    const { data, error } = await this.db.rpc('sleeper_taken', { p_direction: direction });
    fail(error);
    const out: Record<string, number> = {};
    for (const r of (data as { travel_date: string; seats: number }[]) || []) out[r.travel_date] = Number(r.seats);
    return out;
  }
  async createOrder(input: Parameters<DataApi['createOrder']>[0]) {
    await this.c();
    const v = validate(orderSchema, input);
    const r = await this.rpc<{ id: string; ref: string; subtotal: number | null }>('submit_order', { payload: v });
    return { id: r.id, ref: r.ref, items: [], delivery_location: v.delivery_location, with_transport: v.with_transport, contact: v.contact as Order['contact'], status: 'quotation_requested', payment_status: 'unpaid', subtotal: r.subtotal, history: [], created_at: new Date().toISOString() } as Order;
  }
  async createQuoteRequest(input: Parameters<DataApi['createQuoteRequest']>[0]) {
    await this.c();
    const v = validate(quoteRequestSchema, input);
    return this.rpc<{ ref: string }>('submit_quote_request', { payload: v });
  }
  async track(ref: string, phone: string): Promise<TrackResult | null> {
    await this.c();
    const { data, error } = await this.db.rpc('track_booking', { p_ref: ref, p_phone: phone });
    fail(error);
    return (data as TrackResult) || null;
  }

  async customerBundle(): Promise<CustomerBundle> {
    await this.c();
    const s = await this.getStore(); // RLS returns only the signed-in customer's rows
    return {
      cargo: s.cargo, construction: s.construction, machinery: s.machineryBookings, sleeper: s.sleeperBookings, orders: s.orders,
      quotations: s.quotations, payments: s.payments, notifications: s.notifications.filter((n) => n.audience === 'customer'),
    };
  }
  async respondQuotation(id: string, accept: boolean) { await this.rpc('respond_quotation', { p_id: id, p_accept: accept }); }
  async submitPayment(input: Parameters<DataApi['submitPayment']>[0]) {
    await this.c();
    const r = await this.rpc<{ id: string; ref: string }>('submit_payment', { payload: { ...input, slip_path: input.slip_name } });
    return { ...input, id: r.id, ref: r.ref, status: 'pending', created_at: new Date().toISOString() } as Payment;
  }
  async saveProfile(p: UserProfile) {
    await this.c();
    const { error } = await this.db.from('profiles').update({
      full_name: p.full_name, phone: normalizePhone(p.phone), email: p.email, account_type: p.account_type, tax_id: p.tax_id || null,
    }).eq('id', p.id);
    fail(error);
    await this.db.from('customer_addresses').delete().eq('profile_id', p.id);
    if (p.addresses.length) await this.db.from('customer_addresses').insert(p.addresses.map((address) => ({ profile_id: p.id, address })));
    emitChange();
  }
  async markNotificationsRead(_phone: string | null, audience: 'admin' | 'customer') {
    await this.c();
    await this.db.from('notifications').update({ read: true }).eq('audience', audience).eq('read', false);
    emitChange();
  }

  // ───────── Admin (RLS: staff_all policy + require_staff() in functions) ─────────
  async upsert<C extends Collection>(collection: C, record: Store[C][number]) {
    const { error } = await this.db.from(TABLE[collection]).upsert(record as unknown as Row);
    if (error?.code === '23P01') throw new BusinessError('vessel_clash', 'เรือลำนี้มีรอบเดินเรือซ้อนทับช่วงเวลานี้แล้ว', 'This vessel already has an overlapping sailing.');
    if (error?.code === '23514') throw new BusinessError('check', 'ข้อมูลไม่ผ่านเงื่อนไข (เช่น ความจุต่ำกว่าที่จองแล้ว)', 'Values violate a constraint (e.g. capacity below booked).');
    fail(error);
    emitChange();
  }
  async remove(collection: Collection, id: string) {
    await this.c();
    const { error } = await this.db.from(TABLE[collection]).delete().eq('id', id);
    if (error?.code === '23503') throw new BusinessError('in_use', 'ข้อมูลนี้ถูกใช้งานอยู่ ไม่สามารถลบได้', 'Record is in use and cannot be deleted.');
    fail(error);
    emitChange();
  }
  async saveSettings(s: Settings) {
    await this.c();
    const { error } = await this.db.from('site_settings').update({ data: s, updated_at: new Date().toISOString() }).eq('id', 1);
    fail(error);
    emitChange();
  }
  async confirmCargoBooking(id: string) { await this.rpc('confirm_cargo_booking', { p_id: id }); }
  async setCargoStatus(id: string, status: BookingStatus, note: string) { await this.rpc('set_cargo_status', { p_id: id, p_status: status, p_note: note }); }
  async updateCargoBooking(id: string, patch: Parameters<DataApi['updateCargoBooking']>[1]) {
    await this.c();
    await this.rpc('update_cargo_booking', { p_id: id, payload: patch });
  }
  async setCargoPrice(id: string, price: number | null) {
    await this.c();
    const { error } = await this.db.from('cargo_bookings').update({ price }).eq('id', id);
    fail(error); emitChange();
  }
  async updateConstruction(id: string, patch: Partial<ConstructionRequest>, status: ConstructionStatus | null, note: string) {
    await this.c();
    const { history: _h, files: _f, ...rest } = patch;
    if (Object.keys(rest).length) {
      const { error } = await this.db.from('construction_requests').update(rest).eq('id', id);
      fail(error);
    }
    if (status) await this.rpc('set_construction_status', { p_id: id, p_status: status, p_note: note });
    emitChange();
  }
  async setMachineryStatus(id: string, status: MachineryBookingStatus, machinery_id: string | null, note: string) {
    await this.c();
    await this.rpc('set_machinery_status', { p_id: id, p_status: status, p_machinery_id: machinery_id, p_note: note });
  }
  async setOrderStatus(id: string, status: OrderStatus, note: string) { await this.rpc('set_order_status', { p_id: id, p_status: status, p_note: note }); }
  async setSleeperStatus(id: string, status: SleeperStatus, price: number | null, note: string) { await this.rpc('set_sleeper_status', { p_id: id, p_status: status, p_price: price, p_note: note }); }
  async createQuotation(q: Parameters<DataApi['createQuotation']>[0]) {
    await this.c();
    const r = await this.rpc<{ id: string; ref: string }>('create_quotation', { payload: q });
    return { ...q, id: r.id, ref: r.ref, status: 'sent', created_at: new Date().toISOString() } as Quotation;
  }
  async verifyPayment(id: string, ok: boolean, note: string) { await this.rpc('verify_payment', { p_id: id, p_ok: ok, p_note: note }); }
  async resetDemo() { throw new BusinessError('unsupported', 'ใช้ได้เฉพาะโหมดสาธิต', 'Only available in demo mode.'); }
}
