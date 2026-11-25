'use client';

// Demo adapter — keeps a fictional data set in the visitor's browser (localStorage).
// It mirrors the business rules enforced by the SQL functions in supabase/migrations so
// the UI behaves the same way in demo and production. NOTHING here is a real booking.

import type {
  BookingStatus, CargoBooking, Collection, ConstructionRequest, ConstructionStatus, MachineryBooking,
  MachineryBookingStatus, Order, OrderStatus, Payment, Quotation, Settings, StatusEvent, Store, TrackResult, UserProfile,
} from '../types';
import { defaultSettings, demoSeed } from './seed';
import { DATA_EVENT, emitChange, quotationTotal, type DataApi } from './api';
import {
  BusinessError, ValidationError, cargoBookingSchema, constructionSchema, flattenErrors, machinerySchema,
  orderSchema, quoteRequestSchema,
} from '../validation';
import { VEHICLE_CATEGORIES } from '../labels';
import { makeRef, normalizePhone, toTons, uid } from '../utils';
import { z } from 'zod';

const KEY = 'bpt.demo.v1';
let memory: Store | null = null;
// another tab (e.g. a customer booking while the admin dashboard is open) changed the data → reload it
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) memory = null; });

function load(): Store {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { memory = JSON.parse(raw) as Store; memory.settings = { ...defaultSettings(), ...memory.settings }; return memory; }
  } catch { /* fall through */ }
  memory = demoSeed();
  save();
  return memory;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* quota / private mode: keep in memory */ }
  emitChange();
}
const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const ev = (status: string, note?: string, by?: string): StatusEvent => ({ status, at: now(), note, by });

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(flattenErrors(r.error));
  return r.data;
}

function notify(s: Store, n: { audience: 'admin' | 'customer'; phone?: string; th: string; en: string; body: string; link?: string }) {
  s.notifications.unshift({
    id: uid(), audience: n.audience, customer_phone: n.phone ? normalizePhone(n.phone) : undefined,
    title_th: n.th, title_en: n.en, body: n.body, link: n.link, created_at: now(), read: false,
  });
}
function audit(s: Store, actor: string, action: string, entity: string, entity_ref: string) {
  s.audit.unshift({ id: uid(), actor, action, entity, entity_ref, at: now() });
  s.audit = s.audit.slice(0, 500);
}

function cargoLoad(b: Pick<CargoBooking, 'items'>) {
  const tons = b.items.reduce((t, i) => t + (i.weight == null ? 0 : toTons(Number(i.weight), i.weight_unit)), 0);
  const vehicles = b.items.filter((i) => VEHICLE_CATEGORIES.includes(i.category)).reduce((t, i) => t + Number(i.quantity), 0);
  const unknown = b.items.some((i) => i.weight == null || i.weight_unknown || i.size_unknown);
  return { tons: Math.round(tons * 1000) / 1000, vehicles, unknown };
}

function machineWindow(b: MachineryBooking) {
  const start = new Date(b.start_date + 'T00:00:00+07:00').getTime();
  const ms = b.rate_unit === 'day' ? b.duration * 86400_000 : b.duration * 3600_000;
  return [start, start + Math.max(ms, 3600_000)] as const;
}

export class DemoApi implements DataApi {
  readonly mode = 'demo' as const;

  async uploadFiles(files: File[]) {
    await wait(250);
    // Demo mode never stores file contents — only names, so nothing personal is kept.
    return files.map((f) => `demo://${f.name}`);
  }

  async getStore() { await wait(60); return structuredClone(load()); }
  async getSettings() { return structuredClone(load().settings); }

  async createCargoBooking(input: Parameters<DataApi['createCargoBooking']>[0]) {
    const v = validate(cargoBookingSchema, input);
    await wait();
    const s = load();
    const route = s.routes.find((r) => r.id === v.route_id && r.active);
    if (!route) throw new ValidationError({ route_id: 'required' });
    if (!s.settings.transport_modes[v.transport_mode]) throw new BusinessError('mode_disabled', 'รูปแบบการขนส่งนี้ยังไม่เปิดให้บริการ', 'This transport option is not available.');
    const items = v.items.map((i) => ({ ...i, weight: i.weight_unknown ? null : i.weight })) as CargoBooking['items'];
    const { tons, vehicles, unknown } = cargoLoad({ items });
    let shipDate = v.ship_date;
    const sched = v.schedule_id ? s.schedules.find((x) => x.id === v.schedule_id) : undefined;
    if (v.schedule_id) {
      if (!sched || sched.status !== 'open' || sched.route_id !== v.route_id || new Date(sched.depart_at) < new Date())
        throw new BusinessError('schedule_unavailable', 'รอบเรือนี้ไม่เปิดรับจองแล้ว กรุณาเลือกรอบอื่น', 'This sailing is no longer open. Please choose another.');
      shipDate = sched.depart_at.slice(0, 10);
      // pre-check only when weights are known; the binding check happens when staff confirm
      if (!unknown && sched.booked_tons + tons > sched.capacity_tons)
        throw new BusinessError('capacity', `รอบนี้เหลือพื้นที่ ${(sched.capacity_tons - sched.booked_tons).toFixed(1)} ตัน ไม่พอสำหรับสินค้าของคุณ กรุณาเลือกรอบอื่น`, `Only ${(sched.capacity_tons - sched.booked_tons).toFixed(1)} t left on this sailing. Please choose another.`);
      if (!unknown && vehicles > 0 && sched.booked_vehicles + vehicles > sched.vehicle_slots)
        throw new BusinessError('vehicle_capacity', 'ที่จอดรถบนเรือรอบนี้เต็มแล้ว กรุณาเลือกรอบอื่น', 'Not enough vehicle slots on this sailing.');
    }
    const estimated = route.rate_per_ton != null && !unknown ? Math.round(route.rate_per_ton * tons * 100) / 100 : null;
    const b: CargoBooking = {
      id: uid(), ref: makeRef('C'), customer_id: null,
      schedule_id: v.schedule_id || null, route_id: v.route_id, ship_date: shipDate, transport_mode: v.transport_mode,
      items, contact: { ...v.contact, phone: normalizePhone(v.contact.phone) } as CargoBooking['contact'],
      pickup_location: v.pickup_location || '', delivery_location: v.delivery_location || '', files: v.files,
      customer_notes: v.notes || '', needs_review: unknown || !v.schedule_id,
      status: 'pending_review', payment_status: 'unpaid', price: null, estimated_price: estimated,
      history: [ev('pending_review', 'ส่งคำขอจองผ่านเว็บไซต์ / Submitted online')], created_at: now(), is_demo: true,
    };
    s.cargo.unshift(b);
    notify(s, { audience: 'admin', th: 'มีคำขอจองเรือใหม่', en: 'New cargo booking request', body: b.ref, link: '/admin/#bookings' });
    notify(s, { audience: 'customer', phone: b.contact.phone, th: 'ได้รับคำขอจองเรือแล้ว', en: 'Booking request received', body: b.ref });
    audit(s, 'customer', 'create', 'cargo_booking', b.ref);
    save();
    return structuredClone(b);
  }

  /** Mirrors SQL update_cargo_booking(): releases held capacity, applies the edit, re-reserves (all or nothing). */
  async updateCargoBooking(id: string, patch: Parameters<DataApi['updateCargoBooking']>[1], actor: string) {
    await wait();
    const s = load();
    const b = s.cargo.find((x) => x.id === id);
    if (!b) throw new BusinessError('not_found', 'ไม่พบการจอง', 'Booking not found');
    if (['delivered', 'cancelled'].includes(b.status)) throw new BusinessError('state', 'แก้ไขรายการที่ส่งมอบหรือยกเลิกแล้วไม่ได้', 'Delivered or cancelled bookings cannot be edited.');
    const held = ['confirmed', 'cargo_received', 'loading', 'in_transit', 'arrived'].includes(b.status);
    const next: CargoBooking = { ...b, ...patch, items: (patch.items || b.items).map((i) => ({ ...i, weight_unknown: i.weight == null })) };
    const oldS = s.schedules.find((x) => x.id === b.schedule_id);
    const newS = next.schedule_id ? s.schedules.find((x) => x.id === next.schedule_id) : undefined;
    if (next.schedule_id && (!newS || ['cancelled', 'closed'].includes(newS.status))) throw new BusinessError('schedule', 'รอบเรือที่เลือกถูกปิดหรือยกเลิกแล้ว', 'That sailing is closed or cancelled.');
    if (held) {
      const before = cargoLoad(b), after = cargoLoad(next);
      if (!newS || after.unknown) throw new BusinessError('needs_details', 'การจองที่ยืนยันแล้วต้องมีรอบเรือและน้ำหนักครบ', 'Confirmed bookings need a sailing and all weights.');
      const freeT = newS.capacity_tons - newS.booked_tons + (oldS?.id === newS.id ? before.tons : 0);
      const freeV = newS.vehicle_slots - newS.booked_vehicles + (oldS?.id === newS.id ? before.vehicles : 0);
      if (after.tons > freeT) throw new BusinessError('capacity', 'รอบเรือใหม่มีพื้นที่ไม่พอ', 'Not enough capacity on the new sailing.');
      if (after.vehicles > freeV) throw new BusinessError('vehicle_capacity', 'ที่จอดรถบนรอบใหม่ไม่พอ', 'Not enough vehicle slots on the new sailing.');
      if (oldS) { oldS.booked_tons = Math.max(0, +(oldS.booked_tons - before.tons).toFixed(3)); oldS.booked_vehicles = Math.max(0, oldS.booked_vehicles - before.vehicles); if (oldS.status === 'full') oldS.status = 'open'; }
      newS.booked_tons = +(newS.booked_tons + after.tons).toFixed(3); newS.booked_vehicles += after.vehicles;
      if (newS.booked_tons >= newS.capacity_tons) newS.status = 'full';
    }
    if (newS) { next.route_id = newS.route_id; next.ship_date = newS.depart_at.slice(0, 10); }
    next.needs_review = !held && (cargoLoad(next).unknown || !next.schedule_id);
    const moved = next.schedule_id !== b.schedule_id;
    next.history = [...b.history, ev(b.status, moved ? 'เลื่อนรอบเรือ / Rescheduled' : 'เจ้าหน้าที่แก้ไขข้อมูล / Edited by staff', actor)];
    Object.assign(b, next);
    if (moved) notify(s, { audience: 'customer', phone: b.contact.phone, th: 'มีการเปลี่ยนรอบเรือของคุณ', en: 'Your sailing was changed', body: b.ref });
    audit(s, actor, moved ? 'reschedule' : 'edit', 'cargo_booking', b.ref);
    save();
  }

  async createConstructionRequest(input: Parameters<DataApi['createConstructionRequest']>[0]) {
    const v = validate(constructionSchema, input);
    await wait();
    const s = load();
    if (!s.settings.construction_services[v.project_type]) throw new BusinessError('service_disabled', 'บริการนี้ยังไม่เปิดให้บริการ', 'This service is not currently offered.');
    const r: ConstructionRequest = {
      ...(v as unknown as ConstructionRequest), id: uid(), ref: makeRef('K'),
      contact: { ...v.contact, phone: normalizePhone(v.contact.phone) } as ConstructionRequest['contact'],
      status: 'submitted', progress: 0, history: [ev('submitted')], created_at: now(), is_demo: true,
    };
    delete (r as unknown as Record<string, unknown>).accept_terms;
    s.construction.unshift(r);
    notify(s, { audience: 'admin', th: 'มีคำขอใบเสนอราคางานก่อสร้างใหม่', en: 'New construction request', body: r.ref, link: '/admin/#construction' });
    notify(s, { audience: 'customer', phone: r.contact.phone, th: 'ได้รับคำของานก่อสร้างแล้ว', en: 'Construction request received', body: r.ref });
    audit(s, 'customer', 'create', 'construction_request', r.ref);
    save();
    return structuredClone(r);
  }

  async createMachineryBooking(input: Parameters<DataApi['createMachineryBooking']>[0]) {
    const v = validate(machinerySchema, input);
    await wait();
    const s = load();
    const b: MachineryBooking = {
      ...(v as unknown as MachineryBooking), id: uid(), ref: makeRef('M'), machinery_id: null,
      contact: { ...v.contact, phone: normalizePhone(v.contact.phone) } as MachineryBooking['contact'],
      status: 'pending_review', history: [ev('pending_review')], created_at: now(), is_demo: true,
    };
    delete (b as unknown as Record<string, unknown>).accept_terms;
    s.machineryBookings.unshift(b);
    notify(s, { audience: 'admin', th: 'มีคำขอเช่าเครื่องจักรใหม่', en: 'New machinery request', body: b.ref, link: '/admin/#machinery' });
    notify(s, { audience: 'customer', phone: b.contact.phone, th: 'ได้รับคำขอเช่าเครื่องจักรแล้ว', en: 'Machinery request received', body: b.ref });
    audit(s, 'customer', 'create', 'machinery_booking', b.ref);
    save();
    return structuredClone(b);
  }

  async createOrder(input: Parameters<DataApi['createOrder']>[0]) {
    const v = validate(orderSchema, input);
    await wait();
    const s = load();
    const items = v.lines.map((l) => {
      const p = s.products.find((x) => x.id === l.product_id && x.active);
      if (!p) throw new BusinessError('product', 'มีสินค้าที่ไม่พร้อมจำหน่าย', 'A product is no longer available.');
      if (p.stock != null && l.qty > p.stock) throw new BusinessError('stock', `${p.name_th}: จำนวนคงเหลือไม่พอ`, `${p.name_en}: insufficient stock`);
      return { product_id: p.id, name: p.name_th, unit: p.unit_th, qty: l.qty, unit_price: p.price };
    });
    const allPriced = items.every((i) => i.unit_price != null);
    const o: Order = {
      id: uid(), ref: makeRef('O'), customer_id: null, items,
      delivery_location: v.delivery_location, with_transport: v.with_transport, route_id: v.route_id ?? null, notes: v.notes || '',
      contact: { ...v.contact, phone: normalizePhone(v.contact.phone) } as Order['contact'],
      status: 'quotation_requested', payment_status: 'unpaid',
      subtotal: allPriced ? items.reduce((t, i) => t + i.qty * (i.unit_price as number), 0) : null,
      history: [ev('quotation_requested')], created_at: now(), is_demo: true,
    };
    s.orders.unshift(o);
    notify(s, { audience: 'admin', th: 'มีคำสั่งซื้อ/ขอราคาวัสดุใหม่', en: 'New materials order request', body: o.ref, link: '/admin/#orders' });
    notify(s, { audience: 'customer', phone: o.contact.phone, th: 'ได้รับคำขอสั่งซื้อวัสดุแล้ว', en: 'Materials order received', body: o.ref });
    audit(s, 'customer', 'create', 'order', o.ref);
    save();
    return structuredClone(o);
  }

  async createQuoteRequest(input: Parameters<DataApi['createQuoteRequest']>[0]) {
    const v = validate(quoteRequestSchema, input);
    await wait();
    const s = load();
    const ref = makeRef('Q');
    notify(s, { audience: 'admin', th: `คำขอใบเสนอราคา: ${v.service}`, en: `Quotation request: ${v.service}`, body: `${ref} · ${v.contact.full_name} · ${v.contact.phone} · ${v.message}` });
    audit(s, 'customer', 'create', 'quote_request', ref);
    save();
    return { ref };
  }

  async track(ref: string, phone: string): Promise<TrackResult | null> {
    await wait(300);
    const s = load();
    const r = ref.trim().toUpperCase();
    const p = normalizePhone(phone);
    const route = (id?: string | null) => s.routes.find((x) => x.id === id);
    const c = s.cargo.find((x) => x.ref === r && x.contact.phone === p);
    if (c) {
      const sch = s.schedules.find((x) => x.id === c.schedule_id);
      const rt = route(c.route_id);
      return { kind: 'cargo', ref: c.ref, status: c.status, payment_status: c.payment_status, route: rt ? `${rt.name_th} / ${rt.name_en}` : '', service_label_th: 'ขนส่งสินค้าทางทะเล', service_label_en: 'Marine cargo', eta: sch?.arrive_at ?? null, history: c.history, created_at: c.created_at };
    }
    const k = s.construction.find((x) => x.ref === r && x.contact.phone === p);
    if (k) return { kind: 'construction', ref: k.ref, status: k.status, service_label_th: 'งานรับเหมาก่อสร้าง', service_label_en: 'Construction', eta: k.end_date || null, history: k.history, created_at: k.created_at };
    const m = s.machineryBookings.find((x) => x.ref === r && x.contact.phone === p);
    if (m) return { kind: 'machinery', ref: m.ref, status: m.status, service_label_th: 'เช่าเครื่องจักร', service_label_en: 'Machinery rental', eta: m.start_date, history: m.history, created_at: m.created_at };
    const o = s.orders.find((x) => x.ref === r && x.contact.phone === p);
    if (o) return { kind: 'order', ref: o.ref, status: o.status, payment_status: o.payment_status, route: route(o.route_id)?.name_th, service_label_th: 'สั่งซื้อวัสดุก่อสร้าง', service_label_en: 'Materials order', eta: null, history: o.history, created_at: o.created_at };
    return null;
  }

  async customerBundle(phone: string) {
    await wait(120);
    const s = load();
    const p = normalizePhone(phone);
    return structuredClone({
      cargo: s.cargo.filter((x) => x.contact.phone === p),
      construction: s.construction.filter((x) => x.contact.phone === p),
      machinery: s.machineryBookings.filter((x) => x.contact.phone === p),
      orders: s.orders.filter((x) => x.contact.phone === p),
      quotations: s.quotations.filter((x) => x.customer_phone === p && x.status !== 'draft'),
      payments: s.payments.filter((x) => x.customer_phone === p),
      notifications: s.notifications.filter((x) => x.audience === 'customer' && x.customer_phone === p),
    });
  }

  async respondQuotation(id: string, accept: boolean, phone: string) {
    await wait();
    const s = load();
    const q = s.quotations.find((x) => x.id === id && x.customer_phone === normalizePhone(phone));
    if (!q || q.status !== 'sent') throw new BusinessError('quotation', 'ใบเสนอราคานี้ไม่สามารถตอบรับได้', 'This quotation cannot be answered.');
    q.status = accept ? 'accepted' : 'rejected';
    const { total } = quotationTotal(q);
    if (q.kind === 'cargo') {
      const b = s.cargo.find((x) => x.ref === q.target_ref);
      if (b && accept) { b.price = total; if (b.status === 'awaiting_quotation' || b.status === 'pending_review') { b.status = 'awaiting_payment'; b.history.push(ev('awaiting_payment', 'Quotation accepted')); } }
    } else if (q.kind === 'construction') {
      const c = s.construction.find((x) => x.ref === q.target_ref);
      if (c) { c.status = accept ? 'accepted' : 'rejected'; c.history.push(ev(c.status)); }
    } else if (q.kind === 'machinery') {
      const m = s.machineryBookings.find((x) => x.ref === q.target_ref);
      if (m && !accept) { m.status = 'cancelled'; m.history.push(ev('cancelled', 'Quotation rejected')); }
    } else if (q.kind === 'order') {
      const o = s.orders.find((x) => x.ref === q.target_ref);
      if (o) { o.status = accept ? 'awaiting_payment' : 'cancelled'; o.subtotal = accept ? total : o.subtotal; o.history.push(ev(o.status)); }
    }
    notify(s, { audience: 'admin', th: `ลูกค้า${accept ? 'ยอมรับ' : 'ปฏิเสธ'}ใบเสนอราคา`, en: `Customer ${accept ? 'accepted' : 'rejected'} quotation`, body: q.ref });
    audit(s, 'customer', accept ? 'accept' : 'reject', 'quotation', q.ref);
    save();
  }

  async submitPayment(input: Parameters<DataApi['submitPayment']>[0]) {
    await wait();
    if (!(input.amount > 0)) throw new ValidationError({ amount: 'positive' });
    if (!input.slip_name) throw new ValidationError({ slip: 'required' });
    const s = load();
    const p: Payment = { id: uid(), ref: makeRef('P'), ...input, customer_phone: normalizePhone(input.customer_phone), status: 'pending', created_at: now(), verified_at: null, is_demo: true };
    s.payments.unshift(p);
    const target = this.findTarget(s, p.target_kind, p.target_ref);
    if (target && 'payment_status' in target) target.payment_status = 'pending_verification';
    notify(s, { audience: 'admin', th: 'มีสลิปการชำระเงินรอตรวจสอบ', en: 'Payment slip awaiting verification', body: `${p.ref} → ${p.target_ref}`, link: '/admin/#finance' });
    audit(s, 'customer', 'create', 'payment', p.ref);
    save();
    return structuredClone(p);
  }

  async saveProfile(p: UserProfile) {
    const s = load();
    const i = s.users.findIndex((u) => u.id === p.id);
    if (i >= 0) s.users[i] = p; else s.users.push(p);
    save();
  }

  async markNotificationsRead(phone: string | null, audience: 'admin' | 'customer') {
    const s = load();
    s.notifications.forEach((n) => {
      if (n.audience === audience && (audience === 'admin' || n.customer_phone === normalizePhone(phone || ''))) n.read = true;
    });
    save();
  }

  // ───────── Admin ─────────
  async upsert<C extends Collection>(collection: C, record: Store[C][number]) {
    await wait(80);
    const s = load();
    const list = s[collection] as Array<{ id: string }>;
    const rec = record as unknown as { id: string };
    if (collection === 'schedules') {
      const sc = rec as unknown as Store['schedules'][number];
      if (sc.booked_tons > sc.capacity_tons) throw new BusinessError('overbook', 'ความจุต้องไม่น้อยกว่าน้ำหนักที่จองแล้ว', 'Capacity cannot be below already-booked tonnage.');
      // Vessel cannot run two overlapping sailings
      const clash = s.schedules.find((x) => x.id !== sc.id && x.vessel_id === sc.vessel_id && x.status !== 'cancelled' && new Date(x.depart_at) < new Date(sc.arrive_at) && new Date(sc.depart_at) < new Date(x.arrive_at));
      if (clash && sc.status !== 'cancelled') throw new BusinessError('vessel_clash', 'เรือลำนี้มีรอบเดินเรือซ้อนทับช่วงเวลานี้แล้ว', 'This vessel already has an overlapping sailing.');
      if (new Date(sc.arrive_at) <= new Date(sc.depart_at)) throw new BusinessError('times', 'เวลาถึงต้องหลังเวลาออกเรือ', 'Arrival must be after departure.');
    }
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    audit(s, 'admin', i >= 0 ? 'update' : 'create', collection, rec.id);
    save();
  }

  async remove(collection: Collection, id: string) {
    await wait(80);
    const s = load();
    if (collection === 'vessels' && s.schedules.some((x) => x.vessel_id === id && x.status !== 'cancelled' && new Date(x.depart_at) > new Date()))
      throw new BusinessError('in_use', 'เรือลำนี้มีรอบเดินเรือในอนาคต กรุณายกเลิก/ย้ายรอบก่อน', 'Vessel has upcoming sailings. Reassign or cancel them first.');
    if (collection === 'schedules' && s.cargo.some((b) => b.schedule_id === id && !['cancelled', 'delivered'].includes(b.status)))
      throw new BusinessError('in_use', 'รอบนี้มีการจองอยู่ ใช้ “ยกเลิกรอบ” แทนการลบ', 'Sailing has bookings — cancel it instead of deleting.');
    (s[collection] as Array<{ id: string }>) = (s[collection] as Array<{ id: string }>).filter((x) => x.id !== id);
    audit(s, 'admin', 'delete', collection, id);
    save();
  }

  async saveSettings(settings: Settings) {
    const s = load();
    s.settings = settings;
    audit(s, 'admin', 'update', 'settings', 'site');
    save();
  }

  /** Mirrors SQL function public.confirm_cargo_booking(): locks the sailing row, checks capacity, then confirms. */
  async confirmCargoBooking(id: string, actor: string) {
    await wait();
    const s = load();
    const b = s.cargo.find((x) => x.id === id);
    if (!b) throw new BusinessError('not_found', 'ไม่พบการจอง', 'Booking not found');
    if (!['pending_review', 'awaiting_quotation', 'awaiting_payment'].includes(b.status)) throw new BusinessError('state', 'สถานะปัจจุบันยืนยันไม่ได้', 'Booking cannot be confirmed from its current status.');
    if (!b.schedule_id || b.items.some((i) => i.weight == null))
      throw new BusinessError('needs_details', 'ต้องระบุรอบเรือและน้ำหนักให้ครบก่อนยืนยัน — กด “แก้ไข / เลื่อนรอบ”', 'Assign a sailing and fill in all weights first — use “Edit / reschedule”.');
    const sch = s.schedules.find((x) => x.id === b.schedule_id);
    if (!sch || sch.status === 'cancelled' || sch.status === 'closed') throw new BusinessError('schedule', 'รอบเรือถูกยกเลิก/ปิดแล้ว กรุณาย้ายรอบก่อนยืนยัน', 'Sailing is closed or cancelled — reschedule first.');
    const { tons, vehicles } = cargoLoad(b);
    if (sch.booked_tons + tons > sch.capacity_tons) throw new BusinessError('capacity', 'ความจุรอบเรือไม่พอ (ป้องกันการจองเกิน)', 'Not enough capacity — overbooking prevented.');
    if (sch.booked_vehicles + vehicles > sch.vehicle_slots) throw new BusinessError('vehicle_capacity', 'ช่องยานพาหนะไม่พอ', 'Not enough vehicle slots.');
    sch.booked_tons = Math.round((sch.booked_tons + tons) * 1000) / 1000;
    sch.booked_vehicles += vehicles;
    if (sch.booked_tons >= sch.capacity_tons) sch.status = 'full';
    b.status = 'confirmed';
    b.needs_review = false;
    b.history.push(ev('confirmed', '', actor));
    notify(s, { audience: 'customer', phone: b.contact.phone, th: 'การจองเรือของคุณได้รับการยืนยันแล้ว', en: 'Your cargo booking is confirmed', body: b.ref });
    audit(s, actor, 'confirm', 'cargo_booking', b.ref);
    save();
  }

  async setCargoStatus(id: string, status: BookingStatus, note: string, actor: string) {
    if (status === 'confirmed') return this.confirmCargoBooking(id, actor);
    await wait();
    const s = load();
    const b = s.cargo.find((x) => x.id === id);
    if (!b) throw new BusinessError('not_found', 'ไม่พบการจอง', 'Booking not found');
    const held = ['confirmed', 'cargo_received', 'loading'].includes(b.status);
    if (status === 'cancelled' && held) {
      const sch = s.schedules.find((x) => x.id === b.schedule_id);
      if (sch) {
        const { tons, vehicles } = cargoLoad(b);
        sch.booked_tons = Math.max(0, Math.round((sch.booked_tons - tons) * 1000) / 1000);
        sch.booked_vehicles = Math.max(0, sch.booked_vehicles - vehicles);
        if (sch.status === 'full' && sch.booked_tons < sch.capacity_tons) sch.status = 'open';
      }
    }
    const progressing = ['cargo_received', 'loading', 'in_transit', 'arrived', 'delivered'].includes(status);
    if (progressing && !['confirmed', 'cargo_received', 'loading', 'in_transit', 'arrived'].includes(b.status))
      throw new BusinessError('state', 'ต้องยืนยันการจองก่อนอัปเดตสถานะการขนส่ง', 'Confirm the booking before updating transport progress.');
    b.status = status;
    b.history.push(ev(status, note, actor));
    notify(s, { audience: 'customer', phone: b.contact.phone, th: 'อัปเดตสถานะการจองเรือ', en: 'Cargo booking status updated', body: `${b.ref}` });
    audit(s, actor, `status:${status}`, 'cargo_booking', b.ref);
    save();
  }

  async setCargoPrice(id: string, price: number | null, actor: string) {
    const s = load();
    const b = s.cargo.find((x) => x.id === id);
    if (!b) return;
    b.price = price;
    audit(s, actor, 'set_price', 'cargo_booking', b.ref);
    save();
  }

  async updateConstruction(id: string, patch: Partial<ConstructionRequest>, status: ConstructionStatus | null, note: string, actor: string) {
    await wait();
    const s = load();
    const c = s.construction.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    if (status && status !== c.status) {
      c.status = status;
      c.history.push(ev(status, note, actor));
      notify(s, { audience: 'customer', phone: c.contact.phone, th: 'อัปเดตสถานะคำของานก่อสร้าง', en: 'Construction request updated', body: c.ref });
    }
    audit(s, actor, 'update', 'construction_request', c.ref);
    save();
  }

  /** Mirrors the exclusion constraint machinery_bookings_no_overlap in SQL. */
  async setMachineryStatus(id: string, status: MachineryBookingStatus, machinery_id: string | null, note: string, actor: string) {
    await wait();
    const s = load();
    const b = s.machineryBookings.find((x) => x.id === id);
    if (!b) return;
    if (status === 'confirmed') {
      if (!machinery_id) throw new BusinessError('assign', 'กรุณาเลือกเครื่องจักรที่จะใช้', 'Assign a machine before confirming.');
      const m = s.machinery.find((x) => x.id === machinery_id);
      if (!m || m.status !== 'available') throw new BusinessError('unavailable', 'เครื่องจักรนี้ไม่พร้อมใช้งาน', 'Machine is not available.');
      const [a1, a2] = machineWindow(b);
      const clash = s.machineryBookings.find((x) => x.id !== b.id && x.machinery_id === machinery_id && ['confirmed', 'in_progress'].includes(x.status) && (() => { const [b1, b2] = machineWindow(x); return a1 < b2 && b1 < a2; })());
      if (clash) throw new BusinessError('overlap', `ช่วงเวลาซ้อนกับการจอง ${clash.ref}`, `Overlaps confirmed booking ${clash.ref}`);
      b.machinery_id = machinery_id;
    }
    b.status = status;
    b.history.push(ev(status, note, actor));
    notify(s, { audience: 'customer', phone: b.contact.phone, th: 'อัปเดตสถานะการเช่าเครื่องจักร', en: 'Machinery booking updated', body: b.ref });
    audit(s, actor, `status:${status}`, 'machinery_booking', b.ref);
    save();
  }

  async setOrderStatus(id: string, status: OrderStatus, note: string, actor: string) {
    const s = load();
    const o = s.orders.find((x) => x.id === id);
    if (!o) return;
    o.status = status;
    o.history.push(ev(status, note, actor));
    if (status === 'confirmed') {
      for (const it of o.items) {
        const p = s.products.find((x) => x.id === it.product_id);
        if (p && p.stock != null) p.stock = Math.max(0, p.stock - it.qty);
      }
    }
    notify(s, { audience: 'customer', phone: o.contact.phone, th: 'อัปเดตสถานะคำสั่งซื้อวัสดุ', en: 'Materials order updated', body: o.ref });
    audit(s, actor, `status:${status}`, 'order', o.ref);
    save();
  }

  async createQuotation(q: Parameters<DataApi['createQuotation']>[0], actor: string) {
    await wait();
    if (!q.items.length || q.items.some((i) => !(i.qty > 0) || !(i.unit_price >= 0) || !i.description)) throw new ValidationError({ items: 'required' });
    const s = load();
    const quote: Quotation = { ...q, customer_phone: normalizePhone(q.customer_phone), id: uid(), ref: makeRef('Q'), status: 'sent', created_at: now(), is_demo: true };
    s.quotations.unshift(quote);
    const t = this.findTarget(s, q.kind, q.target_ref);
    if (t) {
      if (q.kind === 'cargo') { (t as CargoBooking).status = 'awaiting_quotation'; (t as CargoBooking).history.push(ev('awaiting_quotation', quote.ref, actor)); }
      if (q.kind === 'construction') { (t as ConstructionRequest).status = 'quotation_sent'; (t as ConstructionRequest).history.push(ev('quotation_sent', quote.ref, actor)); }
      if (q.kind === 'machinery') { (t as MachineryBooking).status = 'awaiting_quotation'; (t as MachineryBooking).history.push(ev('awaiting_quotation', quote.ref, actor)); }
      if (q.kind === 'order') { (t as Order).status = 'quoted'; (t as Order).history.push(ev('quoted', quote.ref, actor)); }
    }
    notify(s, { audience: 'customer', phone: quote.customer_phone, th: 'คุณได้รับใบเสนอราคาใหม่', en: 'You have a new quotation', body: `${quote.ref} → ${quote.target_ref}`, link: '/account/' });
    audit(s, actor, 'create', 'quotation', quote.ref);
    save();
    return structuredClone(quote);
  }

  async verifyPayment(id: string, ok: boolean, note: string, actor: string) {
    await wait();
    const s = load();
    const p = s.payments.find((x) => x.id === id);
    if (!p) return;
    p.status = ok ? 'verified' : 'rejected';
    p.note = note;
    p.verified_at = now();
    const t = this.findTarget(s, p.target_kind, p.target_ref) as (CargoBooking | Order | undefined);
    if (t && 'payment_status' in t) {
      t.payment_status = ok ? (p.payment_type === 'deposit' ? 'deposit_paid' : 'paid') : 'unpaid';
      if (ok && 'status' in t && t.status === 'awaiting_payment' && p.target_kind === 'order') { (t as Order).status = 'confirmed'; t.history.push(ev('confirmed', p.ref, actor)); }
    }
    notify(s, { audience: 'customer', phone: p.customer_phone, th: ok ? 'ยืนยันการชำระเงินแล้ว' : 'สลิปการชำระเงินไม่ผ่านการตรวจสอบ', en: ok ? 'Payment verified' : 'Payment slip rejected', body: `${p.ref} ${note || ''}` });
    audit(s, actor, ok ? 'verify' : 'reject', 'payment', p.ref);
    save();
  }

  async resetDemo() {
    memory = demoSeed();
    save();
  }

  private findTarget(s: Store, kind: Quotation['kind'], ref: string) {
    if (kind === 'cargo') return s.cargo.find((x) => x.ref === ref);
    if (kind === 'construction') return s.construction.find((x) => x.ref === ref);
    if (kind === 'machinery') return s.machineryBookings.find((x) => x.ref === ref);
    return s.orders.find((x) => x.ref === ref);
  }
}

export function onDataChange(cb: () => void) {
  window.addEventListener(DATA_EVENT, cb);
  const storage = (e: StorageEvent) => { if (e.key === KEY) { memory = null; cb(); } };
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(DATA_EVENT, cb); window.removeEventListener('storage', storage); };
}
