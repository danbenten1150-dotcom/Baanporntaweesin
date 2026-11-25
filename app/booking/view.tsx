'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor, ArrowLeft, ArrowRight, Bike, Boxes, Camera, Car, Check, Forklift, HelpCircle, Layers, MapPin, Mountain, Package, Pencil,
  Plus, Save, Ship, Trash2, Truck,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { api, useQuery } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { CARGO_CATEGORY, VEHICLE_CATEGORIES } from '@/lib/labels';
import type { CargoBooking, CargoCategory, TransportMode } from '@/lib/types';
import { contactSchema, flattenErrors } from '@/lib/validation';
import { bkkDateKey, cn, formatDate, formatTHB, formatTime, toTons, todayKey } from '@/lib/utils';
import { clearDraft, emptyDraft, newDraftItem, readDraft, writeDraft, type BookingDraft, type DraftItem } from '@/lib/draft';
import { Alert, Button, Checkbox, DemoTag, Field, FilePicker, Input, PageHeader, Segmented, Skeleton, StatusBadge, Textarea } from '@/components/ui';
import { downloadSummary, ErrorBanner, SupportBox, TermsCheck, useSubmitError } from '@/components/shared/forms';
import { SailingRow } from '../schedule/view';

const CARGO_ICON: Record<CargoCategory, React.ComponentType<{ className?: string }>> = {
  general: Package, construction_materials: Layers, sand_stone: Mountain, cement: Boxes, car: Car,
  motorcycle: Bike, truck: Truck, heavy_machinery: Forklift, other: HelpCircle,
};
const EXAMPLES: Partial<Record<CargoCategory, [string, string]>> = {
  general: ['เช่น ตู้เย็น 2 เครื่อง, เฟอร์นิเจอร์', 'e.g. 2 fridges, furniture'],
  construction_materials: ['เช่น ปูน 50 ถุง + เหล็กเส้น 100 เส้น', 'e.g. 50 bags cement + 100 steel bars'],
  sand_stone: ['เช่น ทรายหยาบ 10 คิว', 'e.g. 10 m³ coarse sand'],
  cement: ['เช่น ปูนซีเมนต์ 80 ถุง', 'e.g. 80 bags of cement'],
  car: ['เช่น Toyota Hilux สีขาว', 'e.g. white Toyota Hilux'],
  motorcycle: ['เช่น Honda Click 2 คัน', 'e.g. 2 Honda Click'],
  truck: ['เช่น รถ 6 ล้อ บรรทุกวัสดุ', 'e.g. 6-wheel truck with materials'],
  heavy_machinery: ['เช่น รถแบคโฮ 1 คัน', 'e.g. 1 excavator'],
};

export default function View() {
  const { t, lang, pick } = useLang();
  const { user } = useAuth();
  const { data: store, loading } = useQuery(() => api.getStore(), []);
  const [d, setD] = useState<BookingDraft>(emptyDraft());
  const [ready, setReady] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CargoBooking | null>(null);
  const err = useSubmitError();
  const top = useRef<HTMLDivElement>(null);

  // restore the auto-saved draft (and the quick-booking prefill), then keep saving as the customer types
  useEffect(() => {
    const saved = readDraft();
    if (!saved.date || saved.date < todayKey()) saved.date = todayKey();
    if (user && !saved.contact.full_name && !saved.contact.phone)
      saved.contact = { ...saved.contact, full_name: user.full_name, phone: user.phone, company_name: user.company_name || '' };
    setD(saved); setReady(true);
  }, [user]);
  useEffect(() => { if (ready && !result) { const id = setTimeout(() => writeDraft(d), 300); return () => clearTimeout(id); } }, [d, ready, result]);
  const set = (patch: Partial<BookingDraft>) => setD((x) => ({ ...x, ...patch }));
  const setItem = (i: number, patch: Partial<DraftItem>) => setD((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const pname = (id: string) => { const p = store?.ports.find((x) => x.id === id); return p ? (lang === 'th' ? p.name_th : p.name_en) : ''; };
  const route = store?.routes.find((r) => r.active && r.origin_port_id === d.origin && r.dest_port_id === d.dest);
  const origins = useMemo(() => Array.from(new Set((store?.routes || []).filter((r) => r.active).map((r) => r.origin_port_id))), [store]);
  const dests = (store?.routes || []).filter((r) => r.active && r.origin_port_id === d.origin).map((r) => r.dest_port_id);
  const routeHasSchedules = !!route && (store?.schedules || []).some((s) => s.route_id === route.id && new Date(s.depart_at) > new Date() && s.status !== 'cancelled');
  const sailings = useMemo(() => (route && d.date ? (store?.schedules || []).filter((s) => s.route_id === route.id && bkkDateKey(s.depart_at) === d.date && s.status !== 'cancelled' && new Date(s.depart_at) > new Date()) : []), [store, route, d.date]);
  const schedule = store?.schedules.find((s) => s.id === d.scheduleId);
  const next14 = useMemo(() => Array.from({ length: 14 }, (_, i) => bkkDateKey(new Date(Date.now() + i * 86400000))), []);
  const openOn = (day: string) => (route ? (store?.schedules || []).filter((s) => s.route_id === route.id && bkkDateKey(s.depart_at) === day && s.status === 'open' && new Date(s.depart_at) > new Date()).length : 0);

  const unknown = d.items.some((i) => i.weight_unknown || i.size_unknown);
  const tons = d.items.reduce((x, i) => x + (!i.weight_unknown && Number(i.weight) > 0 ? toTons(Number(i.weight), i.weight_unit) : 0), 0);
  const vehicles = d.items.filter((i) => VEHICLE_CATEGORIES.includes(i.category)).reduce((x, i) => x + Number(i.quantity || 0), 0);
  const estimate = route?.rate_per_ton != null && !unknown ? route.rate_per_ton * tons : null;
  const modes = store?.settings.transport_modes;
  const mode: TransportMode = d.needPickup && d.needDelivery ? 'door_to_door' : d.needPickup ? 'door_to_port' : d.needDelivery ? 'port_to_door' : 'port_to_port';
  const needsReview = unknown || !d.scheduleId;

  const goStep = (n: number) => { set({ step: n }); err.reset(); setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth' }), 30); };
  const fail = (f: Record<string, string>) => {
    err.setFields(f);
    setTimeout(() => document.querySelector('[aria-invalid="true"], [data-err="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
    return false;
  };
  const check = (step: number): boolean => {
    err.reset();
    const f: Record<string, string> = {};
    if (step === 0) {
      if (!d.origin) f.origin = 'required';
      if (!d.dest) f.dest = 'required';
      if (!d.date) f.date = 'date';
      if (sailings.length && !d.scheduleId && !d.noSchedule) f.schedule = 'schedule';
    }
    if (step === 1) {
      d.items.forEach((it, i) => {
        if (it.description.trim().length < 2) f[`items.${i}.description`] = 'required';
        if (!(Number(it.quantity) >= 1)) f[`items.${i}.quantity`] = 'min1';
        if (!it.weight_unknown && !(Number(it.weight) > 0)) f[`items.${i}.weight`] = 'weight';
      });
      if (d.needPickup && d.pickup.trim().length < 3) f.pickup = 'required';
      if (d.needDelivery && d.delivery.trim().length < 3) f.delivery = 'required';
      if (schedule && !unknown && tons > schedule.capacity_tons - schedule.booked_tons) f.capacity = 'capacity';
      if (schedule && !unknown && vehicles > schedule.vehicle_slots - schedule.booked_vehicles) f.capacity = 'vehicles';
    }
    if (step === 2) {
      const r = contactSchema.safeParse(d.contact);
      if (!r.success) Object.entries(flattenErrors(r.error)).forEach(([k, v]) => (f[`contact.${k}`] = v));
      if (!terms) f.accept_terms = 'terms';
    }
    return Object.keys(f).length ? fail(f) : true;
  };

  const submit = async () => {
    if (!check(0)) return goStep(0);
    if (!check(1)) return goStep(1);
    if (!check(2)) return;
    setBusy(true);
    try {
      const files = await api.uploadFiles(photos, 'cargo');
      const b = await api.createCargoBooking({
        route_id: route!.id, schedule_id: d.scheduleId || null, ship_date: d.date, transport_mode: mode,
        items: d.items.map((i) => ({
          category: i.category, description: i.description, quantity: Number(i.quantity),
          weight: i.weight_unknown ? null : Number(i.weight), weight_unit: i.weight_unit, weight_unknown: i.weight_unknown,
          size_unknown: i.size_unknown, length_m: i.length_m ? Number(i.length_m) : null, width_m: i.width_m ? Number(i.width_m) : null,
          height_m: i.height_m ? Number(i.height_m) : null, vehicle_reg: i.vehicle_reg, special: '',
        })),
        contact: d.contact, pickup_location: d.needPickup ? d.pickup : '', delivery_location: d.needDelivery ? d.delivery : '',
        notes: d.notes, files, accept_terms: true,
      } as Parameters<typeof api.createCargoBooking>[0]);
      setResult(b); clearDraft(); top.current?.scrollIntoView();
    } catch (e) { err.handle(e); } finally { setBusy(false); }
  };

  const summaryRows = () => [
    { label: t('เส้นทาง', 'Route'), value: `${pname(d.origin)} → ${pname(d.dest)}` },
    { label: t('วันที่', 'Date'), value: schedule ? `${formatDate(schedule.depart_at, lang)} ${t('เรือออก', 'departs')} ${formatTime(schedule.depart_at, lang)}` : `${d.date ? formatDate(d.date + 'T12:00:00+07:00', lang) : '—'} · ${t('ให้เจ้าหน้าที่จัดรอบเรือ', 'staff will assign a sailing')}` },
    ...d.items.map((i, n) => ({ label: `${t('สินค้า', 'Cargo')} ${d.items.length > 1 ? n + 1 : ''}`, value: `${pick(CARGO_CATEGORY[i.category])} · ${i.description} · ${i.quantity} ${t('ชิ้น/หน่วย', 'pcs')} · ${i.weight_unknown ? t('ไม่ทราบน้ำหนัก', 'weight unknown') : `${i.weight} ${i.weight_unit === 'ton' ? t('ตัน', 't') : t('กก.', 'kg')}`}${i.size_unknown ? ` · ${t('ไม่ทราบขนาด', 'size unknown')}` : i.length_m ? ` · ${i.length_m}×${i.width_m || '-'}×${i.height_m || '-'} ม.` : ''}${i.vehicle_reg ? ` · ${i.vehicle_reg}` : ''}` })),
    ...(d.needPickup ? [{ label: t('ไปรับสินค้าที่', 'Pick up from'), value: d.pickup }] : []),
    ...(d.needDelivery ? [{ label: t('ส่งถึง', 'Deliver to'), value: d.delivery }] : []),
    ...(d.notes ? [{ label: t('หมายเหตุ', 'Notes'), value: d.notes }] : []),
    { label: t('ผู้ติดต่อ', 'Contact'), value: `${d.contact.full_name} · ${d.contact.phone}${d.contact.company_name ? ` · ${d.contact.company_name}` : ''}${d.contact.line_id ? ` · LINE ${d.contact.line_id}` : ''}` },
    { label: t('ราคา', 'Price'), value: estimate != null ? `${formatTHB(estimate, lang)} (${t('ประมาณการ', 'estimate')})` : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting price confirmation from staff') },
  ];

  // loading view mirrors the real layout (same header band, tall content area) so nothing jumps when data arrives
  if (loading || !store || !ready) return (
    <div className="min-h-[110vh]">
      <div className="hero-field text-white"><div className="container py-6 md:py-8">
        <h1 className="banner-type text-[28px] md:text-[38px]">{t('จองเรือขนส่งสินค้า', 'Book cargo shipping')}</h1>
        <p className="mt-1 text-white/95">{t('3 ขั้นตอน · ไม่ต้องสมัครสมาชิก · ข้อมูลบันทึกอัตโนมัติ', '3 steps · no account needed · saved automatically')}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i}><span className="block h-2 rounded-full bg-white/30" /><span className="mt-2 block h-6" /></div>)}</div>
      </div></div>
      <div className="container py-6 md:py-10"><Skeleton className="h-[70vh]" /></div>
    </div>
  );

  // ───────── Submitted ─────────
  if (result) return (
    <>
      <div ref={top} />
      <div className="container max-w-2xl py-8 md:py-12">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-card">
          <div className="bg-emerald-600 px-6 py-8 text-center text-white">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20"><Check className="h-9 w-9" /></span>
            <h1 className="mt-4 font-display text-[24px] font-bold leading-snug md:text-[28px]">{t('ได้รับคำขอจองของคุณเรียบร้อยแล้ว', 'We have received your booking request')}</h1>
            <p className="mt-2 text-[17px] text-white/90">{t('เจ้าหน้าที่จะตรวจสอบข้อมูลและติดต่อกลับเพื่อยืนยันการจอง', 'Our team will check the details and contact you to confirm the booking')}</p>
          </div>
          <div className="space-y-5 p-6">
            <div className="rounded-2xl bg-brand-grey p-5 text-center">
              <p className="text-neutral-600">{t('เลขอ้างอิงการจอง', 'Booking reference')}</p>
              <p className="mt-1 select-all font-mono text-[26px] font-bold tracking-wider">{result.ref}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2"><StatusBadge status="pending_review" />{IS_DEMO && <DemoTag />}</div>
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('วิธีติดตามสถานะ', 'How to track')}</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-6 text-[17px] text-neutral-700">
                <li>{t('จดหรือแคปหน้าจอเลขอ้างอิงด้านบนไว้', 'Note or screenshot the reference above')}</li>
                <li>{t('เข้าเมนู “ติดตาม” ที่ด้านล่างหน้าจอ', 'Open “Track” in the menu')}</li>
                <li>{t('ใส่เลขอ้างอิง กับเบอร์', 'Enter the reference and phone')} <strong>{result.contact.phone}</strong></li>
              </ol>
            </div>
            <Alert tone="info">{t('การจองนี้ยังไม่ใช่การจองที่ยืนยันแล้ว จนกว่าเจ้าหน้าที่จะติดต่อกลับและยืนยัน', 'This is not a confirmed booking until our team contacts you and confirms it.')}</Alert>
            <div className="grid gap-2 sm:grid-cols-2">
              <a href="/track/" className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-[17px] font-semibold text-white hover:bg-brand-dark">{t('ติดตามสถานะ', 'Track status')}</a>
              <Button variant="outline" size="lg" onClick={() => downloadSummary({ title: t('สรุปคำขอจองเรือขนส่งสินค้า', 'Cargo booking request summary'), ref: result.ref, rows: summaryRows(), note: t('คำขอนี้ยังไม่ใช่การจองที่ยืนยันแล้ว จนกว่าเจ้าหน้าที่จะอนุมัติ', 'Not confirmed until approved by our staff.'), demo: IS_DEMO })}>{t('บันทึกสรุปการจอง', 'Save summary')}</Button>
            </div>
            <SupportBox />
          </div>
        </div>
      </div>
    </>
  );

  const STEPS = [t('เส้นทางและวันที่', 'Route & date'), t('รายละเอียดสินค้า', 'Cargo details'), t('ผู้ติดต่อและยืนยัน', 'Contact & confirm')];
  return (
    <>
      <div ref={top} className="scroll-mt-24" />
      <div className="hero-field relative overflow-hidden text-white">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden><path d="M-10 30 C 260 -10, 520 10, 760 -10 L -10 -10Z" fill="#FFD600" /></svg>
        <div className="container relative py-6 md:py-8">
          <h1 className="banner-type text-[28px] md:text-[38px]">{t('จองเรือขนส่งสินค้า', 'Book cargo shipping')}</h1>
          <p className="mt-1 text-white/95">{t('3 ขั้นตอน · ไม่ต้องสมัครสมาชิก · ข้อมูลบันทึกอัตโนมัติ', '3 steps · no account needed · saved automatically')}</p>
          {/* progress */}
          <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t('ขั้นตอน', 'Steps')}>
            {STEPS.map((s, i) => (
              <li key={i} aria-current={d.step === i ? 'step' : undefined}>
                <button type="button" disabled={i > d.step} onClick={() => goStep(i)} className="w-full text-left disabled:cursor-default">
                  <span className={cn('block h-2.5 rounded-full', i <= d.step ? 'bg-brand-yellow' : 'bg-white/30')} />
                  <span className={cn('mt-2 flex items-center gap-1.5 text-[15px] font-semibold', i === d.step ? 'text-brand-yellow' : 'text-white')}>
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]', i < d.step ? 'bg-white text-brand-red' : i === d.step ? 'bg-brand-yellow text-brand-ink' : 'bg-white/25 text-white')}>{i < d.step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                    <span className="hidden sm:inline">{s}</span><span className="sm:hidden">{t('ขั้น', 'Step')} {i + 1}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="container grid min-h-[80vh] gap-8 py-6 md:py-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* ───── STEP 1 ───── */}
          {d.step === 0 && (
            <section className="space-y-7" aria-labelledby="s1">
              <h2 id="s1" className="banner-type text-[24px] text-brand-red [text-shadow:none] md:text-[28px]">{t('ขั้นที่ 1 · เลือกเส้นทางและวันเดินทาง', 'Step 1 · Route and date')}</h2>
              <fieldset data-err={!!err.fields.origin}>
                <legend className="mb-2 flex items-center gap-2 text-lg font-semibold"><Anchor className="h-5 w-5 text-brand-red" />{t('ส่งจากที่ไหน (ต้นทาง)', 'From')}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {origins.map((id) => (
                    <button key={id} type="button" aria-pressed={d.origin === id} onClick={() => set({ origin: id, dest: dests.includes(id) ? '' : d.dest === id ? '' : d.dest, scheduleId: '', noSchedule: false })}
                      className={cn('min-h-[60px] rounded-2xl border-2 px-2 text-[17px] font-semibold transition', d.origin === id ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200 bg-white hover:border-neutral-400')}>{pname(id)}</button>
                  ))}
                </div>
                {err.fields.origin && <p className="mt-1.5 text-[15px] text-red-600">{t('กรุณาเลือกต้นทาง', 'Please choose where from')}</p>}
              </fieldset>
              <fieldset data-err={!!err.fields.dest}>
                <legend className="mb-2 flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-brand-red" />{t('ส่งไปที่ไหน (ปลายทาง)', 'To')}</legend>
                {!d.origin ? <p className="rounded-2xl border border-dashed p-4 text-neutral-500">{t('เลือกต้นทางก่อน', 'Choose “from” first')}</p> : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {dests.map((id) => (
                      <button key={id} type="button" aria-pressed={d.dest === id} onClick={() => set({ dest: id, scheduleId: '', noSchedule: false })}
                        className={cn('min-h-[60px] rounded-2xl border-2 px-2 text-[17px] font-semibold transition', d.dest === id ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200 bg-white hover:border-neutral-400')}>{pname(id)}</button>
                    ))}
                  </div>
                )}
                {err.fields.dest && <p className="mt-1.5 text-[15px] text-red-600">{t('กรุณาเลือกปลายทาง', 'Please choose where to')}</p>}
              </fieldset>
              <fieldset data-err={!!err.fields.date}>
                <legend className="mb-2 text-lg font-semibold">{t('วันที่ต้องการส่งสินค้า', 'Shipping date')}</legend>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {next14.map((day) => {
                    const n = openOn(day); const dt = new Date(day + 'T12:00:00+07:00');
                    return (
                      <button key={day} type="button" onClick={() => set({ date: day, scheduleId: '', noSchedule: false })} aria-pressed={d.date === day}
                        aria-label={`${formatDate(day + 'T12:00:00+07:00', lang)}${n ? ` · ${n} ${t('รอบว่าง', 'open')}` : ''}`}
                        className={cn('flex w-[70px] shrink-0 flex-col items-center rounded-2xl border-2 py-2.5', d.date === day ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200 bg-white')}>
                        <span className="text-[13px]">{dt.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', timeZone: 'Asia/Bangkok' })}</span>
                        <span className="font-display text-[22px] font-bold leading-tight">{dt.getUTCDate()}</span>
                        <span className="text-[13px]">{dt.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { month: 'short', timeZone: 'Asia/Bangkok' })}</span>
                        {routeHasSchedules && <span className={cn('mt-1 h-2 w-2 rounded-full', n ? (d.date === day ? 'bg-brand-yellow' : 'bg-emerald-500') : 'bg-neutral-300')} />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 max-w-xs"><Field label={t('หรือเลือกวันอื่นจากปฏิทิน', 'Or pick another date')}><Input type="date" value={d.date} min={todayKey()} onChange={(e) => set({ date: e.target.value, scheduleId: '', noSchedule: false })} /></Field></div>
                {routeHasSchedules && <p className="mt-2 flex items-center gap-2 text-[15px] text-neutral-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{t('จุดเขียว = มีรอบเรือว่าง', 'Green dot = open sailing')}</p>}
                {err.fields.date && <p className="mt-1.5 text-[15px] text-red-600">{t('กรุณาเลือกวันที่', 'Please choose a date')}</p>}
              </fieldset>
              {route && d.date && (
                <fieldset data-err={!!err.fields.schedule}>
                  <legend className="mb-2 text-lg font-semibold">{t('เลือกรอบเรือ', 'Choose a sailing')}</legend>
                  {sailings.length > 0 ? (
                    <div className="space-y-3">
                      {sailings.map((s) => <SailingRow key={s.id} s={s} store={store} selected={s.id === d.scheduleId} onBook={() => set({ scheduleId: s.id, noSchedule: false })} />)}
                      <button type="button" onClick={() => set({ scheduleId: '', noSchedule: true })} aria-pressed={d.noSchedule}
                        className={cn('flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-[17px]', d.noSchedule ? 'border-brand-red bg-red-50/40 font-semibold' : 'border-neutral-200 bg-white')}>
                        <HelpCircle className="h-6 w-6 shrink-0 text-brand-red" />{t('ไม่แน่ใจ — ให้เจ้าหน้าที่เลือกรอบให้', 'Not sure — let staff choose')}
                      </button>
                      {err.fields.schedule && <p className="text-[15px] text-red-600">{t('กรุณาเลือกรอบเรือ หรือให้เจ้าหน้าที่เลือกให้', 'Choose a sailing, or let staff choose')}</p>}
                    </div>
                  ) : (
                    <Alert tone="info">{routeHasSchedules
                      ? t('วันนี้ไม่มีรอบเรือที่ประกาศไว้ ส่งคำขอได้เลย เจ้าหน้าที่จะจัดรอบที่ใกล้ที่สุดและโทรกลับ หรือเลือกวันที่มีจุดสีเขียว', 'No announced sailing on this date. Send the request and staff will arrange the nearest one — or pick a green-dot day.')
                      : t('ยังไม่มีตารางเรือออนไลน์สำหรับเส้นทางนี้ ส่งคำขอได้เลย เจ้าหน้าที่จะจัดรอบและโทรยืนยัน', 'No online timetable for this route yet. Send the request and staff will arrange a sailing.')}</Alert>
                  )}
                </fieldset>
              )}
            </section>
          )}

          {/* ───── STEP 2 ───── */}
          {d.step === 1 && (
            <section className="space-y-6" aria-labelledby="s2">
              <h2 id="s2" className="banner-type text-[24px] text-brand-red [text-shadow:none] md:text-[28px]">{t('ขั้นที่ 2 · รายละเอียดสินค้า', 'Step 2 · Cargo details')}</h2>
              {d.items.map((it, i) => (
                <div key={i} className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
                  {d.items.length > 1 && (
                    <div className="flex items-center justify-between"><p className="text-lg font-bold text-brand-red">{t('รายการที่', 'Item')} {i + 1}</p>
                      <Button variant="ghost" size="sm" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}><Trash2 className="h-5 w-5" />{t('ลบรายการ', 'Remove')}</Button></div>
                  )}
                  <fieldset>
                    <legend className="mb-2 text-lg font-semibold">{t('สินค้าประเภทไหน', 'What kind of cargo?')}</legend>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                      {(Object.keys(CARGO_CATEGORY) as CargoCategory[]).map((k) => { const I = CARGO_ICON[k]; return (
                        <button key={k} type="button" aria-pressed={it.category === k} onClick={() => setItem(i, { category: k })}
                          className={cn('flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-2 text-center text-[14px] font-semibold leading-tight transition', it.category === k ? 'border-brand-red bg-red-50 text-brand-red' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400')}>
                          <I className="h-7 w-7" />{pick(CARGO_CATEGORY[k])}
                        </button>
                      ); })}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field label={t('สินค้าคืออะไร', 'What is it?')} required error={err.fields[`items.${i}.description`]}>
                      <Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} invalid={!!err.fields[`items.${i}.description`]} placeholder={t(...(EXAMPLES[it.category] || ['เช่น เครื่องมือช่าง 3 กล่อง', 'e.g. 3 boxes of tools']))} />
                    </Field>
                    <Field label={t('จำนวน', 'Quantity')} required error={err.fields[`items.${i}.quantity`]}>
                      <Input type="number" inputMode="numeric" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} invalid={!!err.fields[`items.${i}.quantity`]} />
                    </Field>
                  </div>
                  <div data-err={!!err.fields[`items.${i}.weight`]}>
                    <span className="mb-1.5 block text-base font-medium">{t('น้ำหนักรวมโดยประมาณ', 'Approximate total weight')} {!it.weight_unknown && <span className="text-brand-red">*</span>}</span>
                    {!it.weight_unknown && (
                      <div className="flex flex-wrap gap-2">
                        <Input type="number" inputMode="decimal" min={0} step="any" className="w-40" value={it.weight} onChange={(e) => setItem(i, { weight: e.target.value })} invalid={!!err.fields[`items.${i}.weight`]} placeholder="0" aria-label={t('น้ำหนัก', 'Weight')} />
                        <Segmented value={it.weight_unit} onChange={(v) => setItem(i, { weight_unit: v })} options={[{ value: 'ton', label: t('ตัน', 'tonnes') }, { value: 'kg', label: t('กิโลกรัม', 'kg') }]} />
                      </div>
                    )}
                    <Checkbox className="mt-3 text-base" checked={it.weight_unknown} onChange={(v) => setItem(i, { weight_unknown: v, weight: v ? '' : it.weight })}>{t('ไม่ทราบน้ำหนัก — ให้เจ้าหน้าที่ช่วยประเมิน', 'Weight unknown — let staff estimate')}</Checkbox>
                    {err.fields[`items.${i}.weight`] && <p className="mt-1.5 text-[15px] text-red-600">{t('กรุณาใส่น้ำหนัก หรือติ๊ก “ไม่ทราบน้ำหนัก”', 'Enter a weight or tick “weight unknown”')}</p>}
                  </div>
                  <div>
                    <span className="mb-1.5 block text-base font-medium">{t('ขนาด (ถ้าทราบ)', 'Size (if known)')}</span>
                    {!it.size_unknown && (
                      <div className="grid max-w-md grid-cols-3 gap-2">
                        {(['length_m', 'width_m', 'height_m'] as const).map((k, n) => (
                          <Field key={k} label={[t('ยาว (ม.)', 'Length m'), t('กว้าง (ม.)', 'Width m'), t('สูง (ม.)', 'Height m')][n]}>
                            <Input type="number" inputMode="decimal" min={0} step="any" value={it[k]} onChange={(e) => setItem(i, { [k]: e.target.value })} />
                          </Field>
                        ))}
                      </div>
                    )}
                    <Checkbox className="mt-3 text-base" checked={it.size_unknown} onChange={(v) => setItem(i, { size_unknown: v })}>{t('ไม่ทราบขนาด', 'Size unknown')}</Checkbox>
                  </div>
                  {VEHICLE_CATEGORIES.includes(it.category) && (
                    <Field label={t('ทะเบียนรถ (ถ้ามี)', 'Vehicle registration (if any)')}><Input value={it.vehicle_reg} onChange={(e) => setItem(i, { vehicle_reg: e.target.value })} placeholder={t('เช่น 1กข 1234 ชุมพร', 'e.g. 1กข 1234 Chumphon')} /></Field>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={() => set({ items: [...d.items, newDraftItem()] })}><Plus className="h-5 w-5" />{t('เพิ่มสินค้าอีกรายการ', 'Add another item')}</Button>

              <div className="rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
                <FilePicker label={t('รูปถ่ายสินค้า (ไม่บังคับ แต่ช่วยให้ประเมินราคาได้เร็วขึ้น)', 'Cargo photos (optional — helps us quote faster)')} files={photos} onChange={setPhotos} accept="image/*"
                  hint={t('ถ่ายรูปจากกล้องหรือเลือกจากคลังภาพได้ · ระบบไม่บันทึกรูปลงฉบับร่าง หากออกจากหน้านี้ต้องแนบใหม่', 'Use the camera or your gallery · photos are not kept in the saved draft')} />
                <div className="mt-2 flex items-center gap-2 text-[15px] text-neutral-500"><Camera className="h-4 w-4" />{t('บนมือถือ แตะแล้วเลือก “ถ่ายรูป” ได้เลย', 'On a phone, tap and choose “Take photo”')}</div>
              </div>

              {(modes?.door_to_port || modes?.port_to_door || modes?.door_to_door) && (
                <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
                  <p className="text-lg font-semibold">{t('ต้องการบริการรถรับ-ส่งเพิ่มไหม?', 'Need truck pick-up or delivery?')}</p>
                  {(modes?.door_to_port || modes?.door_to_door) && <Checkbox className="text-base" checked={d.needPickup} onChange={(v) => set({ needPickup: v })}>{t(`ให้รถไปรับสินค้าถึงที่ (ก่อนลงเรือที่${pname(d.origin)})`, `Pick up from my place (before the ship at ${pname(d.origin)})`)}</Checkbox>}
                  {d.needPickup && <Field label={t('ที่อยู่สำหรับไปรับสินค้า', 'Pick-up address')} required error={err.fields.pickup}><Textarea className="min-h-[80px]" value={d.pickup} onChange={(e) => set({ pickup: e.target.value })} invalid={!!err.fields.pickup} /></Field>}
                  {(modes?.port_to_door || modes?.door_to_door) && <Checkbox className="text-base" checked={d.needDelivery} onChange={(v) => set({ needDelivery: v })}>{t(`ให้ส่งต่อถึงหน้างาน (หลังเรือถึง${pname(d.dest)})`, `Deliver to my site (after arrival at ${pname(d.dest)})`)}</Checkbox>}
                  {d.needDelivery && <Field label={t('ที่อยู่ปลายทาง', 'Delivery address')} required error={err.fields.delivery}><Textarea className="min-h-[80px]" value={d.delivery} onChange={(e) => set({ delivery: e.target.value })} invalid={!!err.fields.delivery} /></Field>}
                </div>
              )}
              <Field label={t('หมายเหตุถึงเจ้าหน้าที่ (ไม่บังคับ)', 'Notes for our team (optional)')}><Textarea className="min-h-[80px]" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t('เช่น ต้องใช้รถเครนยก, ของแตกง่าย', 'e.g. needs crane lift, fragile')} /></Field>
              {err.fields.capacity && <Alert tone="bad">{err.fields.capacity === 'vehicles' ? t('ที่จอดรถบนเรือรอบนี้ไม่พอ กลับไปขั้นที่ 1 เพื่อเลือกรอบอื่น หรือเลือก “ให้เจ้าหน้าที่เลือกรอบให้”', 'Not enough vehicle space — go back and pick another sailing, or let staff choose') : t('สินค้าหนักเกินพื้นที่ที่เหลือในรอบนี้ กลับไปขั้นที่ 1 เพื่อเลือกรอบอื่น หรือเลือก “ให้เจ้าหน้าที่เลือกรอบให้”', 'Too heavy for the space left — go back and pick another sailing, or let staff choose')}</Alert>}
            </section>
          )}

          {/* ───── STEP 3 ───── */}
          {d.step === 2 && (
            <section className="space-y-6" aria-labelledby="s3">
              <h2 id="s3" className="banner-type text-[24px] text-brand-red [text-shadow:none] md:text-[28px]">{t('ขั้นที่ 3 · ข้อมูลผู้ติดต่อและยืนยันคำขอ', 'Step 3 · Contact and confirm')}</h2>
              <div className="grid gap-4 rounded-3xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:p-6">
                <Field label={t('ชื่อผู้ติดต่อ', 'Your name')} required error={err.fields['contact.full_name']}><Input autoComplete="name" value={d.contact.full_name} onChange={(e) => set({ contact: { ...d.contact, full_name: e.target.value } })} invalid={!!err.fields['contact.full_name']} placeholder={t('เช่น สมชาย ใจดี', 'e.g. Somchai Jaidee')} /></Field>
                <Field label={t('เบอร์โทรศัพท์', 'Phone number')} required error={err.fields['contact.phone']} hint={t('เจ้าหน้าที่จะโทรยืนยันที่เบอร์นี้', 'We will call this number to confirm')}><Input type="tel" inputMode="tel" autoComplete="tel" value={d.contact.phone} onChange={(e) => set({ contact: { ...d.contact, phone: e.target.value } })} invalid={!!err.fields['contact.phone']} placeholder="081 234 5678" /></Field>
                <Field label={t('ชื่อบริษัท (ไม่บังคับ)', 'Company (optional)')}><Input autoComplete="organization" value={d.contact.company_name} onChange={(e) => set({ contact: { ...d.contact, company_name: e.target.value } })} /></Field>
                <Field label={t('LINE ID (ไม่บังคับ)', 'LINE ID (optional)')}><Input value={d.contact.line_id} onChange={(e) => set({ contact: { ...d.contact, line_id: e.target.value } })} /></Field>
                <details className="sm:col-span-2">
                  <summary className="cursor-pointer py-2 text-base font-semibold text-brand-red">{t('ข้อมูลเพิ่มเติมสำหรับออกใบกำกับภาษี (ไม่บังคับ)', 'Extra details for tax invoice (optional)')}</summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label={t('อีเมล', 'Email')} error={err.fields['contact.email']}><Input type="email" inputMode="email" value={d.contact.email} onChange={(e) => set({ contact: { ...d.contact, email: e.target.value } })} /></Field>
                    <Field label={t('เลขประจำตัวผู้เสียภาษี 13 หลัก', '13-digit tax ID')} error={err.fields['contact.tax_id']}><Input inputMode="numeric" maxLength={13} value={d.contact.tax_id} onChange={(e) => set({ contact: { ...d.contact, tax_id: e.target.value.replace(/\D/g, '') } })} /></Field>
                  </div>
                </details>
              </div>
              <div className="rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
                <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{t('สรุปการจอง', 'Booking summary')}</h3>
                  <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => goStep(0)}><Pencil className="h-4 w-4" />{t('แก้เส้นทาง', 'Edit route')}</Button><Button size="sm" variant="ghost" onClick={() => goStep(1)}><Pencil className="h-4 w-4" />{t('แก้สินค้า', 'Edit cargo')}</Button></div></div>
                <dl className="mt-3 divide-y">
                  {summaryRows().map((r, i) => <div key={i} className="grid gap-0.5 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-neutral-500">{r.label}</dt><dd className="text-[17px] font-medium">{r.value}</dd></div>)}
                </dl>
                {needsReview && <Alert tone="info" className="mt-3">{t('เจ้าหน้าที่จะโทรสอบถามรายละเอียดที่ยังไม่ทราบ (น้ำหนัก ขนาด หรือรอบเรือ) ก่อนยืนยันการจอง', 'Our team will call to check the details you left open (weight, size or sailing) before confirming.')}</Alert>}
                <p className="mt-3 text-[15px] text-neutral-600">{t('ยังไม่ต้องชำระเงินตอนนี้ เจ้าหน้าที่จะแจ้งราคาและวิธีชำระหลังตรวจสอบ', 'No payment now — we will tell you the price and how to pay after checking.')}{store.settings.deposit_percent != null && ` ${t('มัดจำ', 'Deposit')} ${store.settings.deposit_percent}%`}</p>
              </div>
              <div data-err={!!err.fields.accept_terms}><TermsCheck checked={terms} onChange={setTerms} error={err.fields.accept_terms} /></div>
            </section>
          )}

          <ErrorBanner message={err.message} />
          <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:justify-between">
            {d.step > 0 ? <Button variant="outline" size="lg" onClick={() => goStep(d.step - 1)}><ArrowLeft className="h-5 w-5" />{t('ย้อนกลับ', 'Back')}</Button> : <span />}
            {d.step < 2
              ? <Button size="lg" className="w-full text-lg sm:w-auto" onClick={() => { if (check(d.step)) goStep(d.step + 1); }}>{t('ถัดไป', 'Continue')}<ArrowRight className="h-5 w-5" /></Button>
              : <Button size="lg" variant="accent" className="w-full text-lg sm:w-auto" loading={busy} onClick={submit}><Ship className="h-5 w-5" />{t('ส่งคำขอจอง', 'Send booking request')}</Button>}
          </div>
          <p className="flex items-center gap-1.5 text-[14px] text-neutral-500"><Save className="h-4 w-4" />{t('ระบบบันทึกข้อมูลที่กรอกไว้ให้อัตโนมัติ กลับมาทำต่อได้', 'Your answers are saved automatically')}</p>
        </div>

        <aside className="hidden h-fit space-y-4 lg:sticky lg:top-24 lg:block">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="font-bold">{t('การจองของคุณ', 'Your booking')}</h3>
            <dl className="mt-3 space-y-3 text-[15px]">
              <div><dt className="text-neutral-500">{t('เส้นทาง', 'Route')}</dt><dd className="font-semibold">{d.origin && d.dest ? `${pname(d.origin)} → ${pname(d.dest)}` : '—'}</dd></div>
              <div><dt className="text-neutral-500">{t('วันที่', 'Date')}</dt><dd className="font-semibold">{schedule ? `${formatDate(schedule.depart_at, lang)} ${formatTime(schedule.depart_at, lang)}` : d.date ? formatDate(d.date + 'T12:00:00+07:00', lang) : '—'}</dd></div>
              <div><dt className="text-neutral-500">{t('น้ำหนัก', 'Weight')}</dt><dd className="font-semibold">{unknown ? t('รอเจ้าหน้าที่ประเมิน', 'to be estimated') : tons ? `${tons.toFixed(2)} ${t('ตัน', 't')}` : '—'}</dd></div>
              <div className="border-t pt-3"><dt className="text-neutral-500">{t('ราคา', 'Price')}</dt><dd className="font-display text-lg font-bold text-brand-red">{estimate != null ? formatTHB(estimate, lang) : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting staff price')}</dd></div>
            </dl>
          </div>
          {schedule?.is_demo && <Alert>{t('รอบเรือนี้เป็นข้อมูลตัวอย่าง', 'This sailing is demo data.')}</Alert>}
          <SupportBox />
        </aside>
      </div>
    </>
  );
}
