'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Ban, CalendarClock, CheckCircle2, FileSpreadsheet, FileText, Pencil, Phone, Printer, Search, Wallet, X, XCircle,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import { BOOKING_FLOW, BOOKING_STATUS, CARGO_CATEGORY, PAYMENT_STATUS, TRANSPORT_MODE } from '@/lib/labels';
import type { BookingStatus, CargoBooking, CargoCategory, CargoItem, Store } from '@/lib/types';
import { bkkDateKey, downloadFile, formatDate, formatTHB, formatTime, toCSV, toExcel, toTons, printHtml } from '@/lib/utils';
import { Badge, Button, DemoTag, Field, Input, Modal, Select, StatusBadge, Textarea, useConfirm } from '@/components/ui';
import { summaryHtml, Timeline } from '@/components/shared/forms';
import { QuotationBuilder, useAction, useActor } from './kit';

const NEXT: Partial<Record<BookingStatus, BookingStatus>> = {
  confirmed: 'cargo_received', cargo_received: 'loading', loading: 'in_transit', in_transit: 'arrived', arrived: 'delivered',
};

export function bookingRows(s: Store, list: CargoBooking[], lang: 'th' | 'en') {
  return list.map((b) => {
    const r = s.routes.find((x) => x.id === b.route_id);
    const sch = s.schedules.find((x) => x.id === b.schedule_id);
    return {
      [lang === 'th' ? 'เลขอ้างอิง' : 'Reference']: b.ref,
      [lang === 'th' ? 'วันที่จอง' : 'Created']: formatDate(b.created_at, lang, true),
      [lang === 'th' ? 'ลูกค้า' : 'Customer']: b.contact.full_name,
      [lang === 'th' ? 'เบอร์โทร' : 'Phone']: b.contact.phone,
      [lang === 'th' ? 'บริษัท' : 'Company']: b.contact.company_name || '',
      [lang === 'th' ? 'เลขผู้เสียภาษี' : 'Tax ID']: b.contact.tax_id || '',
      [lang === 'th' ? 'เส้นทาง' : 'Route']: r ? (lang === 'th' ? r.name_th : r.name_en) : b.route_id,
      [lang === 'th' ? 'วันที่ขนส่ง' : 'Ship date']: b.ship_date,
      [lang === 'th' ? 'รอบเรือ' : 'Sailing']: sch ? formatTime(sch.depart_at, lang) : '',
      [lang === 'th' ? 'น้ำหนัก (ตัน)' : 'Tonnes']: +b.items.reduce((x, i) => x + (i.weight == null ? 0 : toTons(Number(i.weight), i.weight_unit)), 0).toFixed(3),
      [lang === 'th' ? 'สินค้า' : 'Cargo']: b.items.map((i) => `${i.description} x${i.quantity}`).join('; '),
      [lang === 'th' ? 'สถานะ' : 'Status']: (lang === 'th' ? BOOKING_STATUS[b.status].th : BOOKING_STATUS[b.status].en),
      [lang === 'th' ? 'ชำระเงิน' : 'Payment']: (lang === 'th' ? PAYMENT_STATUS[b.payment_status].th : PAYMENT_STATUS[b.payment_status].en),
      [lang === 'th' ? 'ราคา' : 'Price']: b.price ?? '',
      DEMO: b.is_demo ? 'yes' : '',
    };
  });
}

export function Bookings({ s, openRef }: { s: Store; openRef?: string | null }) {
  const { t, lang, pick } = useLang();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'review' | BookingStatus>('all');
  const [route, setRoute] = useState('');
  const [date, setDate] = useState('');
  const [openId, setOpenId] = useState<string | null>(() => s.cargo.find((b) => b.ref === openRef)?.id || null);
  const rows = useMemo(() => s.cargo.filter((b) => {
    if (status === 'review' && !b.needs_review) return false;
    if (status !== 'all' && status !== 'review' && b.status !== status) return false;
    if (route && b.route_id !== route) return false;
    if (date && b.ship_date !== date) return false;
    if (q) { const n = q.toLowerCase().replace(/[\s-]/g, ''); if (!`${b.ref} ${b.contact.full_name} ${b.contact.phone} ${b.contact.company_name || ''}`.toLowerCase().replace(/[\s-]/g, '').includes(n)) return false; }
    return true;
  }), [s, q, status, route, date]);
  const current = openId ? s.cargo.find((b) => b.id === openId) : null;
  const routeName = (id: string) => { const r = s.routes.find((x) => x.id === id); return r ? (lang === 'th' ? r.name_th : r.name_en) : id; };
  const exp = (kind: 'xls' | 'csv') => {
    const data = bookingRows(s, rows, lang);
    const name = `bookings-${new Date().toISOString().slice(0, 10)}`;
    if (kind === 'csv') downloadFile(`${name}.csv`, toCSV(data), 'text/csv;charset=utf-8');
    else downloadFile(`${name}.xls`, toExcel(data, 'Bookings'), 'application/vnd.ms-excel');
  };
  const filtered = q || status !== 'all' || route || date;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-5 w-5 text-neutral-500" />
          <Input className="pl-11" placeholder={t('ค้นหา ชื่อลูกค้า เบอร์โทร หรือเลขอ้างอิง', 'Search name, phone or reference')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหา', 'Search')} /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label={t('สถานะ', 'Status')}>
            <option value="all">{t('ทุกสถานะ', 'All statuses')}</option>
            <option value="review">⚠ {t('ต้องตรวจสอบข้อมูล', 'Needs review')}</option>
            {(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((k) => <option key={k} value={k}>{pick(BOOKING_STATUS[k])}</option>)}
          </Select>
          <Select value={route} onChange={(e) => setRoute(e.target.value)} aria-label={t('เส้นทาง', 'Route')}>
            <option value="">{t('ทุกเส้นทาง', 'All routes')}</option>
            {s.routes.map((r) => <option key={r.id} value={r.id}>{lang === 'th' ? r.name_th : r.name_en}</option>)}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('วันที่ขนส่ง', 'Ship date')} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] text-neutral-600">{t(`พบ ${rows.length} รายการ`, `${rows.length} bookings`)}
            {filtered && <button className="ml-2 font-semibold text-brand-red" onClick={() => { setQ(''); setStatus('all'); setRoute(''); setDate(''); }}>{t('ล้างตัวกรอง', 'Clear')}</button>}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exp('xls')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button size="sm" variant="outline" onClick={() => exp('csv')}><FileSpreadsheet className="h-4 w-4" />CSV</Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-neutral-500">{t('ไม่พบรายการตามเงื่อนไข', 'No bookings match')}</div> : (
        <ul className="space-y-2.5">
          {rows.map((b) => (
            <li key={b.id}>
              <button onClick={() => setOpenId(b.id)} className="grid w-full gap-2 rounded-2xl border bg-white p-4 text-left transition hover:border-brand-red hover:shadow-card md:grid-cols-[1.2fr_1.3fr_1fr_auto] md:items-center">
                <div><p className="font-mono text-[15px] font-bold">{b.ref}</p><p className="text-[14px] text-neutral-500">{formatDate(b.created_at, lang, true)}</p></div>
                <div><p className="font-semibold">{b.contact.full_name}{b.contact.company_name && <span className="font-normal text-neutral-500"> · {b.contact.company_name}</span>}</p><p className="text-[15px] text-neutral-600">{b.contact.phone}</p></div>
                <div><p className="text-[15px]">{routeName(b.route_id)}</p><p className="text-[14px] text-neutral-500">{b.ship_date}{!b.schedule_id && ` · ${t('ยังไม่ระบุรอบ', 'no sailing yet')}`}</p></div>
                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  <StatusBadge status={b.status} />
                  {b.needs_review && <Badge tone="pending"><AlertTriangle className="h-3.5 w-3.5" />{t('ต้องตรวจสอบ', 'Review')}</Badge>}
                  {b.is_demo && <DemoTag />}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && <BookingPanel b={current} s={s} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function BookingPanel({ b, s, onClose }: { b: CargoBooking; s: Store; onClose: () => void }) {
  const { t, lang, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const confirm = useConfirm();
  const [quote, setQuote] = useState(false);
  const [edit, setEdit] = useState(false);
  const [price, setPrice] = useState(b.price != null ? String(b.price) : '');
  const [notes, setNotes] = useState(b.internal_notes || '');
  const sch = s.schedules.find((x) => x.id === b.schedule_id);
  const r = s.routes.find((x) => x.id === b.route_id);
  const canConfirm = ['pending_review', 'awaiting_quotation', 'awaiting_payment'].includes(b.status);
  const next = NEXT[b.status];
  const slips = s.payments.filter((p) => p.target_ref === b.ref && p.status === 'pending');
  const missing = !b.schedule_id || b.items.some((i) => i.weight == null);

  const reject = async () => {
    if (await confirm({ title: t(`ปฏิเสธ/ยกเลิกการจอง ${b.ref}?`, `Reject / cancel ${b.ref}?`), body: t('ลูกค้าจะได้รับแจ้ง และพื้นที่บนเรือจะถูกคืน การกระทำนี้ย้อนกลับไม่ได้', 'The customer is notified and the space is released. This cannot be undone.'), confirm: t('ยืนยันการยกเลิก', 'Yes, cancel it'), danger: true }))
      act(() => api.setCargoStatus(b.id, 'cancelled', 'Rejected by staff', actor), t('ยกเลิกการจองแล้ว', 'Booking cancelled'));
  };
  const print = () => printHtml(`${b.ref}.html`, summaryHtml({
    title: t('ใบรับจองขนส่งสินค้า', 'Cargo booking document'), ref: b.ref, demo: !!b.is_demo, note: t('เอกสารภายในบริษัท', 'Internal document'),
    rows: [
      { label: t('ลูกค้า', 'Customer'), value: `${b.contact.full_name} · ${b.contact.phone}${b.contact.company_name ? ` · ${b.contact.company_name}` : ''}${b.contact.tax_id ? ` · Tax ${b.contact.tax_id}` : ''}` },
      { label: t('เส้นทาง', 'Route'), value: r ? (lang === 'th' ? r.name_th : r.name_en) : '' },
      { label: t('รอบเรือ', 'Sailing'), value: sch ? `${formatDate(sch.depart_at, lang)} ${formatTime(sch.depart_at, lang)} · ${s.vessels.find((v) => v.id === sch.vessel_id)?.name || ''}` : t('ยังไม่ระบุ', 'not set') },
      { label: t('รูปแบบ', 'Option'), value: pick(TRANSPORT_MODE[b.transport_mode]) },
      ...b.items.map((i, n) => ({ label: `${t('สินค้า', 'Cargo')} ${n + 1}`, value: `${pick(CARGO_CATEGORY[i.category])} · ${i.description} · ${i.quantity} · ${i.weight ?? '?'} ${i.weight_unit}` })),
      { label: t('สถานะ', 'Status'), value: pick(BOOKING_STATUS[b.status]) },
      { label: t('ราคา', 'Price'), value: b.price != null ? formatTHB(b.price, lang) : '—' },
    ],
  }));

  return (
    <Modal open onClose={onClose} title={b.ref} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /><StatusBadge status={b.payment_status} />{b.is_demo && <DemoTag />}</div>
        {b.needs_review && <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200"><AlertTriangle className="h-6 w-6 shrink-0" /><div>
          <p className="font-semibold">{t('ต้องตรวจสอบก่อนยืนยัน', 'Review before confirming')}</p>
          <p className="text-[15px]">{[!b.schedule_id && t('ลูกค้ายังไม่ได้เลือกรอบเรือ', 'no sailing chosen'), b.items.some((i) => i.weight == null) && t('ไม่ทราบน้ำหนัก', 'weight unknown'), b.items.some((i) => i.size_unknown) && t('ไม่ทราบขนาด', 'size unknown')].filter(Boolean).join(' · ')} — {t('โทรสอบถามลูกค้า แล้วกด “แก้ไข / เลื่อนรอบ”', 'call the customer, then use “Edit / reschedule”')}</p></div></div>}

        {/* big, simple actions */}
        <div className="grid gap-2 sm:grid-cols-2">
          {canConfirm && <Button size="lg" onClick={() => missing ? setEdit(true) : act(() => api.confirmCargoBooking(b.id, actor), t('อนุมัติการจองแล้ว', 'Booking approved'))}><CheckCircle2 className="h-5 w-5" />{missing ? t('กรอกข้อมูลแล้วอนุมัติ', 'Complete details, then approve') : t('อนุมัติการจอง', 'Approve booking')}</Button>}
          {next && <Button size="lg" onClick={() => act(() => api.setCargoStatus(b.id, next, '', actor), t('อัปเดตสถานะแล้ว', 'Status updated'))}><ArrowRight className="h-5 w-5" />{t('ขั้นต่อไป:', 'Next:')} {pick(BOOKING_STATUS[next])}</Button>}
          <Button size="lg" variant="outline" onClick={() => setEdit(true)}><Pencil className="h-5 w-5" />{t('แก้ไข / เลื่อนรอบ', 'Edit / reschedule')}</Button>
          <Button size="lg" variant="outline" onClick={() => setQuote(true)}><FileText className="h-5 w-5" />{t('สร้างใบเสนอราคา', 'Create quotation')}</Button>
          <Button size="lg" variant="outline" onClick={print}><Printer className="h-5 w-5" />{t('พิมพ์เอกสาร', 'Print document')}</Button>
          <a href={`tel:${b.contact.phone}`} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-5 text-[17px] font-semibold hover:border-brand-red"><Phone className="h-5 w-5" />{t('โทรหาลูกค้า', 'Call customer')}</a>
          {!['cancelled', 'delivered'].includes(b.status) && <Button size="lg" variant="danger" onClick={reject}><Ban className="h-5 w-5" />{t('ปฏิเสธ / ยกเลิก', 'Reject / cancel')}</Button>}
        </div>

        {slips.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-blue-900"><Wallet className="h-5 w-5" />{t('มีสลิปรอตรวจสอบ', 'Payment slip waiting')}</p>
            {slips.map((p) => (
              <div key={p.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                <span className="text-[15px]">{formatTHB(p.amount, lang)} · {p.payment_type} · {p.slip_name.split('/').pop()}</span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => act(() => api.verifyPayment(p.id, true, '', actor), t('ยืนยันการชำระแล้ว', 'Payment verified'))}><CheckCircle2 className="h-4 w-4" />{t('ยืนยันยอดเงิน', 'Verify')}</Button>
                  <Button size="sm" variant="danger" onClick={async () => { if (await confirm({ title: t('ปฏิเสธสลิปนี้?', 'Reject this slip?'), confirm: t('ปฏิเสธสลิป', 'Reject slip'), danger: true })) act(() => api.verifyPayment(p.id, false, '', actor), t('ปฏิเสธสลิปแล้ว', 'Slip rejected')); }}><XCircle className="h-4 w-4" /></Button>
                </span>
              </div>
            ))}
            <p className="mt-2 text-[14px] text-blue-900">{t('ตรวจยอดเงินเข้าบัญชีจริงก่อนกดยืนยันทุกครั้ง', 'Always check the bank statement before verifying')}</p>
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-brand-grey p-4 sm:grid-cols-2">
          <div><dt className="text-[14px] text-neutral-500">{t('ลูกค้า', 'Customer')}</dt><dd className="font-semibold">{b.contact.full_name}{b.contact.company_name && ` (${b.contact.company_name})`}</dd><dd className="text-[15px]">{b.contact.phone}{b.contact.line_id && ` · LINE ${b.contact.line_id}`}</dd></div>
          <div><dt className="text-[14px] text-neutral-500">{t('เส้นทาง / รอบเรือ', 'Route / sailing')}</dt><dd className="font-semibold">{r ? (lang === 'th' ? r.name_th : r.name_en) : '—'}</dd>
            <dd className="text-[15px]">{sch ? `${formatDate(sch.depart_at, lang)} ${formatTime(sch.depart_at, lang)} · ${s.vessels.find((v) => v.id === sch.vessel_id)?.name} · ${sch.booked_tons}/${sch.capacity_tons} t` : `${b.ship_date} · ${t('ยังไม่ระบุรอบ', 'no sailing yet')}`}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[14px] text-neutral-500">{t('สินค้า', 'Cargo')}</dt>
            {b.items.map((i, n) => <dd key={n} className="text-[15px]">• {pick(CARGO_CATEGORY[i.category])}: {i.description} — {i.quantity} × {i.weight == null ? <strong className="text-amber-700">{t('ไม่ทราบน้ำหนัก', 'weight unknown')}</strong> : `${i.weight} ${i.weight_unit}`}{i.size_unknown ? ` · ${t('ไม่ทราบขนาด', 'size unknown')}` : i.length_m ? ` · ${i.length_m}×${i.width_m}×${i.height_m} m` : ''}{i.vehicle_reg ? ` · ${i.vehicle_reg}` : ''}</dd>)}</div>
          <div><dt className="text-[14px] text-neutral-500">{t('รูปแบบ', 'Option')}</dt><dd className="text-[15px]">{pick(TRANSPORT_MODE[b.transport_mode])}{b.pickup_location && ` · ${t('รับ', 'from')} ${b.pickup_location}`}{b.delivery_location && ` · ${t('ส่ง', 'to')} ${b.delivery_location}`}</dd></div>
          {b.customer_notes && <div><dt className="text-[14px] text-neutral-500">{t('หมายเหตุลูกค้า', 'Customer notes')}</dt><dd className="text-[15px]">{b.customer_notes}</dd></div>}
          {b.files.length > 0 && <div className="sm:col-span-2"><dt className="text-[14px] text-neutral-500">{t('ไฟล์แนบ', 'Files')}</dt><dd className="text-[15px]">{b.files.map((f) => f.split('/').pop()).join(', ')}</dd></div>}
        </dl>

        <div className="grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
          <Field label={t('ราคา (บาท)', 'Price (THB)')}><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('ยังไม่กำหนด', 'not set')} /></Field>
          <Button variant="outline" onClick={() => act(() => api.setCargoPrice(b.id, price === '' ? null : Number(price), actor), t('บันทึกราคาแล้ว', 'Price saved'))}>{t('บันทึกราคา', 'Save price')}</Button>
        </div>
        <Field label={t('บันทึกภายใน (ลูกค้าไม่เห็น)', 'Internal notes (hidden from customer)')}><Textarea className="min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (b.internal_notes || '') && act(() => api.upsert('cargo', { ...b, internal_notes: notes }), t('บันทึกแล้ว', 'Saved'))} /></Field>
        <div><h4 className="mb-3 font-semibold">{t('ประวัติสถานะ', 'Status history')}</h4><Timeline flow={BOOKING_FLOW} history={b.history} current={b.status} /></div>
      </div>
      <QuotationBuilder open={quote} onClose={() => setQuote(false)} kind="cargo" targetRef={b.ref} phone={b.contact.phone} defaultDeposit={s.settings.deposit_percent} />
      {edit && <EditBooking b={b} s={s} onClose={() => setEdit(false)} />}
    </Modal>
  );
}

function EditBooking({ b, s, onClose }: { b: CargoBooking; s: Store; onClose: () => void }) {
  const { t, lang, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const [items, setItems] = useState<CargoItem[]>(b.items.map((i) => ({ ...i })));
  const [scheduleId, setScheduleId] = useState(b.schedule_id || '');
  const [busy, setBusy] = useState(false);
  const options = s.schedules.filter((x) => x.route_id === b.route_id && x.status !== 'cancelled' && x.status !== 'closed' && new Date(x.depart_at) > new Date()).sort((a, c) => a.depart_at.localeCompare(c.depart_at));
  const setItem = (i: number, p: Partial<CargoItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const need = items.reduce((x, i) => x + (i.weight == null ? 0 : toTons(Number(i.weight), i.weight_unit)), 0);
  return (
    <Modal open onClose={onClose} title={`${t('แก้ไข / เลื่อนรอบ', 'Edit / reschedule')} · ${b.ref}`} wide>
      <div className="space-y-5">
        <Field label={t('รอบเรือ', 'Sailing')} hint={t('เลือกรอบใหม่เพื่อเลื่อนรอบ — ระบบย้ายพื้นที่บนเรือให้อัตโนมัติและแจ้งลูกค้า', 'Pick another sailing to reschedule — space moves automatically and the customer is notified')}>
          <Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
            <option value="">{t('— ยังไม่ระบุรอบ —', '— no sailing —')}</option>
            {options.map((o) => { const free = o.capacity_tons - o.booked_tons; const full = o.id !== b.schedule_id && free < Math.max(need, 0.001); return (
              <option key={o.id} value={o.id} disabled={full}>{formatDate(o.depart_at, lang)} {formatTime(o.depart_at, lang)} · {s.vessels.find((v) => v.id === o.vessel_id)?.name} · {full ? t('เต็ม', 'full') : `${t('ว่าง', 'free')} ${free.toFixed(1)} t`}{o.id === b.schedule_id ? ` (${t('รอบปัจจุบัน', 'current')})` : ''}</option>); })}
          </Select>
        </Field>
        {items.map((it, i) => (
          <div key={i} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
            <Field label={t('ประเภท', 'Category')}><Select value={it.category} onChange={(e) => setItem(i, { category: e.target.value as CargoCategory })}>{Object.entries(CARGO_CATEGORY).map(([k, v]) => <option key={k} value={k}>{pick(v)}</option>)}</Select></Field>
            <Field label={t('รายละเอียด', 'Description')}><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></Field>
            <Field label={t('จำนวน', 'Quantity')}><Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} /></Field>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Field label={t('น้ำหนัก', 'Weight')}><Input type="number" min={0} step="any" value={it.weight ?? ''} onChange={(e) => setItem(i, { weight: e.target.value === '' ? null : Number(e.target.value) })} placeholder={t('ไม่ทราบ', 'unknown')} /></Field>
              <Field label={t('หน่วย', 'Unit')}><Select value={it.weight_unit} onChange={(e) => setItem(i, { weight_unit: e.target.value as 'kg' | 'ton' })}><option value="ton">{t('ตัน', 't')}</option><option value="kg">kg</option></Select></Field>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              {(['length_m', 'width_m', 'height_m'] as const).map((k, n) => <Field key={k} label={[t('ยาว ม.', 'L m'), t('กว้าง ม.', 'W m'), t('สูง ม.', 'H m')][n]}><Input type="number" min={0} step="any" value={it[k] ?? ''} onChange={(e) => setItem(i, { [k]: e.target.value === '' ? null : Number(e.target.value), size_unknown: false })} /></Field>)}
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}><X className="h-4 w-4" />{t('ยกเลิก', 'Cancel')}</Button>
          <Button loading={busy} onClick={async () => {
            setBusy(true);
            const ok = await act(() => api.updateCargoBooking(b.id, { items, schedule_id: scheduleId || null }, actor), t('บันทึกการแก้ไขแล้ว', 'Changes saved'));
            setBusy(false); if (ok) onClose();
          }}><CalendarClock className="h-4 w-4" />{t('บันทึก', 'Save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function todaysNew(s: Store) {
  const today = bkkDateKey(new Date());
  return s.cargo.filter((b) => bkkDateKey(b.created_at) === today);
}
