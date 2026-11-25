'use client';

import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Clock, Download, FileSpreadsheet, Hammer, Inbox, Ship, Wallet, Banknote, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, quotationTotal } from '@/lib/data';
import { BOOKING_STATUS } from '@/lib/labels';
import type { Store } from '@/lib/types';
import { bkkDateKey, cn, downloadFile, formatDate, formatTHB, formatTime, toCSV, toExcel } from '@/lib/utils';
import { Button, DemoTag, Modal, StatusBadge, Tabs } from '@/components/ui';
import { bookingRows, todaysNew } from './bookings';

function BigCard({ icon: Icon, label, value, sub, tone, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-brand-red hover:shadow-card">
      <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', tone)}><Icon className="h-7 w-7" /></span>
      <span className="min-w-0"><span className="block font-display text-[30px] font-bold leading-none tabular-nums">{value}</span>
        <span className="mt-1.5 block font-semibold">{label}</span>{sub && <span className="block text-[14px] text-neutral-500">{sub}</span>}</span>
    </button>
  );
}

export function Overview({ s, go, openBooking }: { s: Store; go: (m: string) => void; openBooking: (ref: string) => void }) {
  const { t, lang } = useLang();
  const today = bkkDateKey(new Date());
  const newToday = todaysNew(s);
  const pending = s.cargo.filter((b) => b.status === 'pending_review').length + s.machineryBookings.filter((m) => m.status === 'pending_review').length + s.construction.filter((c) => c.status === 'submitted').length;
  const sailings = s.schedules.filter((x) => bkkDateKey(x.depart_at) === today && x.status !== 'cancelled').sort((a, b) => a.depart_at.localeCompare(b.depart_at));
  const active = s.cargo.filter((b) => ['confirmed', 'cargo_received', 'loading', 'in_transit', 'arrived'].includes(b.status)).length
    + s.construction.filter((c) => c.status === 'in_progress').length + s.machineryBookings.filter((m) => ['confirmed', 'in_progress'].includes(m.status)).length;
  const awaitingPay = s.cargo.filter((b) => b.status === 'awaiting_payment').length + s.orders.filter((o) => o.status === 'awaiting_payment').length + s.payments.filter((p) => p.status === 'pending').length;
  const revenue = s.payments.filter((p) => p.status === 'verified').reduce((x, p) => x + p.amount, 0);
  const waiting = s.cargo.filter((b) => b.status === 'pending_review').slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <BigCard icon={Inbox} label={t('รายการจองใหม่วันนี้', 'New bookings today')} value={newToday.length} tone="bg-red-50 text-brand-red" onClick={() => go('bookings')} />
        <BigCard icon={Clock} label={t('รายการรอยืนยัน', 'Waiting for approval')} value={pending} sub={t('เรือ เครื่องจักร และงานก่อสร้าง', 'ships, machinery & construction')} tone="bg-amber-50 text-amber-700" onClick={() => go('bookings')} />
        <BigCard icon={Ship} label={t('เที่ยวเรือวันนี้', 'Sailings today')} value={sailings.length} tone="bg-blue-50 text-blue-700" onClick={() => go('schedules')} />
        <BigCard icon={Hammer} label={t('งานที่กำลังดำเนินการ', 'Jobs in progress')} value={active} tone="bg-violet-50 text-violet-700" onClick={() => go('bookings')} />
        <BigCard icon={Wallet} label={t('รายการรอชำระเงิน', 'Awaiting payment')} value={awaitingPay} sub={t('รวมสลิปที่รอตรวจ', 'incl. slips to check')} tone="bg-amber-50 text-amber-700" onClick={() => go('finance')} />
        <BigCard icon={Banknote} label={t('รายได้ที่ได้รับจริง', 'Revenue received')} value={formatTHB(revenue, lang).replace('.00', '')} sub={t('เฉพาะยอดที่ตรวจสอบแล้ว', 'verified payments only')} tone="bg-emerald-50 text-emerald-700" onClick={() => go('reports')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{t('รอยืนยัน — จัดการได้เลย', 'Waiting — act now')}</h3><Button size="sm" variant="ghost" onClick={() => go('bookings')}>{t('ดูทั้งหมด', 'See all')}<ChevronRight className="h-4 w-4" /></Button></div>
          {waiting.length === 0 ? <p className="mt-4 rounded-xl bg-brand-grey p-6 text-center text-neutral-500">{t('ไม่มีรายการรอยืนยัน 👍', 'Nothing waiting')}</p> : (
            <ul className="mt-3 divide-y">{waiting.map((b) => (
              <li key={b.id}><button onClick={() => openBooking(b.ref)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-brand-grey">
                <span><span className="block font-semibold">{b.contact.full_name} <span className="font-mono text-[14px] font-normal text-neutral-500">{b.ref}</span></span>
                  <span className="text-[14px] text-neutral-500">{s.routes.find((r) => r.id === b.route_id)?.[lang === 'th' ? 'name_th' : 'name_en']} · {b.ship_date}</span></span>
                <span className="flex items-center gap-1.5">{b.needs_review && <span className="text-amber-600" title={t('ต้องตรวจสอบ', 'Needs review')}>⚠</span>}<ChevronRight className="h-5 w-5 text-neutral-500" /></span>
              </button></li>
            ))}</ul>
          )}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="text-lg font-bold">{t('เที่ยวเรือวันนี้', 'Today’s sailings')}</h3>
          <div className="mt-4 space-y-4">
            {sailings.length === 0 && <p className="rounded-xl bg-brand-grey p-6 text-center text-neutral-500">{t('ไม่มีเที่ยวเรือวันนี้', 'No sailings today')}</p>}
            {sailings.map((x) => {
              const r = s.routes.find((y) => y.id === x.route_id); const v = s.vessels.find((y) => y.id === x.vessel_id);
              const pct = x.capacity_tons ? (x.booked_tons / x.capacity_tons) * 100 : 0;
              return (
                <div key={x.id} className="grid grid-cols-[70px_1fr] items-center gap-3">
                  <span className="font-display text-2xl font-bold tabular-nums">{formatTime(x.depart_at, lang)}</span>
                  <div><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{lang === 'th' ? r?.name_th : r?.name_en} · {v?.name}</span><span className="whitespace-nowrap text-[14px] tabular-nums text-neutral-600">{x.booked_tons}/{x.capacity_tons} {t('ตัน', 't')}</span></div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-neutral-100"><div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${Math.min(100, pct)}%` }} /></div></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Dedicated notification center. */
export function NotificationCenter({ s, open, onClose, go }: { s: Store; open: boolean; onClose: () => void; go: (m: string) => void }) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<'all' | 'unread'>('unread');
  const list = s.notifications.filter((n) => n.audience === 'admin' && (tab === 'all' || !n.read));
  return (
    <Modal open={open} onClose={onClose} title={t('ศูนย์การแจ้งเตือน', 'Notification center')}>
      <div className="flex items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'unread', label: t('ยังไม่อ่าน', 'Unread'), count: s.notifications.filter((n) => n.audience === 'admin' && !n.read).length }, { value: 'all', label: t('ทั้งหมด', 'All') }]} />
        <Button size="sm" variant="ghost" onClick={() => api.markNotificationsRead(null, 'admin')}><CheckCheck className="h-4 w-4" />{t('อ่านทั้งหมด', 'Mark all read')}</Button>
      </div>
      <ul className="mt-4 divide-y">
        {list.length === 0 && <li className="py-10 text-center text-neutral-500"><Bell className="mx-auto mb-2 h-8 w-8 text-neutral-300" />{t('ไม่มีการแจ้งเตือนใหม่', 'No new notifications')}</li>}
        {list.slice(0, 60).map((n) => (
          <li key={n.id}><button onClick={() => { if (n.link?.includes('#')) go(n.link.split('#')[1]); onClose(); }} className="flex w-full gap-3 py-3 text-left hover:bg-brand-grey">
            <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-neutral-200' : 'bg-brand-red')} />
            <span className="min-w-0"><span className="block font-semibold">{lang === 'th' ? n.title_th : n.title_en}</span>
              <span className="block truncate text-[14px] text-neutral-500">{n.body} · {formatDate(n.created_at, lang, true)}</span></span>
          </button></li>
        ))}
      </ul>
    </Modal>
  );
}

export function Reports({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return bkkDateKey(d).slice(0, 7); }), []);
  const revenue = months.map((m) => s.payments.filter((p) => p.status === 'verified' && bkkDateKey(p.verified_at || p.created_at).startsWith(m)).reduce((x, p) => x + p.amount, 0));
  const bookings = months.map((m) => s.cargo.filter((b) => bkkDateKey(b.created_at).startsWith(m)).length);
  const maxR = Math.max(1, ...revenue), maxB = Math.max(1, ...bookings);
  const byRoute = s.routes.map((r) => ({ r, n: s.cargo.filter((b) => b.route_id === r.id && b.status !== 'cancelled').length }));
  const byStatus = Object.keys(BOOKING_STATUS).map((k) => ({ k, n: s.cargo.filter((b) => b.status === k).length })).filter((x) => x.n);
  const name = (x: string) => `${x}-${new Date().toISOString().slice(0, 10)}`;
  const both = (label: string, file: string, rows: Record<string, unknown>[]) => (
    <div className="flex items-center justify-between gap-2 rounded-xl border p-3">
      <span className="font-medium">{label} <span className="text-[14px] text-neutral-500">({rows.length})</span></span>
      <span className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={() => downloadFile(`${name(file)}.xls`, toExcel(rows, file), 'application/vnd.ms-excel')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
        <Button size="sm" variant="ghost" onClick={() => downloadFile(`${name(file)}.csv`, toCSV(rows), 'text/csv;charset=utf-8')}><Download className="h-4 w-4" />CSV</Button>
      </span>
    </div>
  );
  const Bars = ({ data, max, fmt }: { data: number[]; max: number; fmt: (n: number) => string }) => (
    <div className="mt-4 flex h-44 items-end gap-2">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[13px] tabular-nums text-neutral-600">{v ? fmt(v) : ''}</span>
          <div className="w-full rounded-t-lg bg-brand-red" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 2, opacity: v ? 1 : 0.15 }} />
          <span className="text-[13px] text-neutral-500">{new Date(months[i] + '-15').toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-6">
      {s.cargo.some((b) => b.is_demo) && <p className="flex items-center gap-2 text-[15px] text-neutral-600"><DemoTag />{t('ตัวเลขรวมข้อมูลตัวอย่าง', 'Figures include demo data')}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{t('รายได้ที่ได้รับจริง 6 เดือน', 'Verified revenue, 6 months')}</h3><Bars data={revenue} max={maxR} fmt={(n) => `${Math.round(n / 1000)}k`} /><p className="mt-2 text-[14px] text-neutral-500">{t('นับเฉพาะยอดที่เจ้าหน้าที่ตรวจสอบแล้ว (บาท)', 'Staff-verified payments only (THB)')}</p></section>
        <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{t('จำนวนการจองเรือ 6 เดือน', 'Cargo bookings, 6 months')}</h3><Bars data={bookings} max={maxB} fmt={(n) => String(n)} /></section>
        <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{t('การจองตามเส้นทาง', 'Bookings by route')}</h3>
          <div className="mt-4 space-y-3">{byRoute.map(({ r, n }) => { const max = Math.max(1, ...byRoute.map((x) => x.n)); return (
            <div key={r.id}><div className="flex justify-between text-[15px]"><span>{lang === 'th' ? r.name_th : r.name_en}</span><span className="font-semibold tabular-nums">{n}</span></div>
              <div className="mt-1 h-2.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-red" style={{ width: `${(n / max) * 100}%` }} /></div></div>); })}</div></section>
        <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{t('สถานะการจองตอนนี้', 'Bookings by status')}</h3>
          <div className="mt-4 flex flex-wrap gap-2">{byStatus.map(({ k, n }) => <span key={k} className="flex items-center gap-2"><StatusBadge status={k} /><strong className="tabular-nums">{n}</strong></span>)}</div></section>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-lg font-bold">{t('ส่งออกข้อมูล', 'Export data')}</h3>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {both(t('การจองเรือ', 'Cargo bookings'), 'bookings', bookingRows(s, s.cargo, lang))}
          {both(t('ยอดขายวัสดุ', 'Material sales'), 'orders', s.orders.map((o) => ({ ref: o.ref, created_at: o.created_at, customer: o.contact.full_name, phone: o.contact.phone, items: o.items.map((i) => `${i.name} x${i.qty}`).join('; '), subtotal: o.subtotal ?? '', status: o.status, payment_status: o.payment_status })))}
          {both(t('การชำระเงิน', 'Payments'), 'payments', s.payments.map((p) => ({ ref: p.ref, target: p.target_ref, amount: p.amount, type: p.payment_type, method: p.method, status: p.status, created_at: p.created_at, verified_at: p.verified_at ?? '' })))}
          {both(t('ใบเสนอราคา', 'Quotations'), 'quotations', s.quotations.map((q) => ({ ref: q.ref, kind: q.kind, target: q.target_ref, total: quotationTotal(q).total, status: q.status, created_at: q.created_at })))}
          {both(t('งานก่อสร้าง', 'Construction'), 'construction', s.construction.map((c) => ({ ref: c.ref, type: c.project_type, location: c.location, customer: c.contact.full_name, phone: c.contact.phone, status: c.status, progress: c.progress, created_at: c.created_at })))}
          {both(t('เช่าเครื่องจักร', 'Machinery'), 'machinery', s.machineryBookings.map((m) => ({ ref: m.ref, type: m.machinery_type, start: m.start_date, duration: m.duration, unit: m.rate_unit, customer: m.contact.full_name, phone: m.contact.phone, status: m.status })))}
        </div>
      </section>
    </div>
  );
}
