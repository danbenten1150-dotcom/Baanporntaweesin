'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, Car, Filter, Ship, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { bkkDateKey, cn, formatDate, formatTime, todayKey } from '@/lib/utils';
import type { Schedule, Store } from '@/lib/types';
import { Button, DemoTag, EmptyState, Input, PageHeader, Select, Skeleton, StatusBadge } from '@/components/ui';
import { writeDraft } from '@/lib/draft';

export function capacityLeft(s: Schedule) { return Math.max(0, s.capacity_tons - s.booked_tons); }

export function SailingRow({ s, store, onBook, selected }: { s: Schedule; store: Store; onBook: () => void; selected?: boolean }) {
  const { t, lang } = useLang();
  const route = store.routes.find((r) => r.id === s.route_id);
  const vessel = store.vessels.find((v) => v.id === s.vessel_id);
  const pct = s.capacity_tons ? Math.min(100, (s.booked_tons / s.capacity_tons) * 100) : 100;
  const bookable = s.status === 'open' && new Date(s.depart_at) > new Date();
  return (
    <div className={cn('grid gap-4 rounded-2xl border bg-white p-4 transition sm:grid-cols-[110px_1fr_auto] sm:items-center sm:p-5', selected ? 'border-brand-red ring-4 ring-brand-red/10' : 'border-neutral-200 hover:border-neutral-300')}>
      <div className="flex items-baseline gap-3 sm:block">
        <p className="font-display text-3xl font-bold tabular-nums leading-none text-brand-ink">{formatTime(s.depart_at, lang)}</p>
        <p className="text-sm text-neutral-500 sm:mt-1.5">{t('ถึงประมาณ', 'ETA')} <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-700">{formatTime(s.arrive_at, lang)}</span></p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{lang === 'th' ? route?.name_th : route?.name_en}</p>
          <StatusBadge status={s.status} />
          {s.is_demo && <DemoTag />}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600"><Ship className="h-4 w-4 text-neutral-500" />{vessel?.name || '—'} · {formatDate(s.depart_at, lang)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="w-full max-w-[260px]">
            <div className="flex justify-between text-xs text-neutral-500"><span>{t('พื้นที่บรรทุกคงเหลือ', 'Cargo space left')}</span><span className="whitespace-nowrap font-semibold tabular-nums text-neutral-800">{capacityLeft(s).toLocaleString()} / {s.capacity_tons.toLocaleString()} {t('ตัน', 't')}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100"><div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${pct}%` }} /></div>
          </div>
          {s.vehicle_slots > 0 && <span className="flex items-center gap-1.5 whitespace-nowrap text-neutral-600"><Car className="h-4 w-4" />{s.vehicle_slots - s.booked_vehicles} / {s.vehicle_slots} {t('คัน', 'vehicles')}</span>}
        </div>
      </div>
      <Button onClick={onBook} disabled={!bookable} variant={selected ? 'accent' : 'primary'} className="w-full sm:w-auto">
        {selected ? t('เลือกแล้ว', 'Selected') : bookable ? t('จองรอบนี้', 'Book now') : t('ไม่เปิดรับ', 'Unavailable')}{bookable && !selected && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function View() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { data: store, loading } = useQuery(() => api.getStore(), []);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [vessel, setVessel] = useState('');
  const [avail, setAvail] = useState<'all' | 'open'>('open');
  const [limit, setLimit] = useState(20);

  const rows = useMemo(() => {
    if (!store) return [];
    return store.schedules.filter((s) => {
      const r = store.routes.find((x) => x.id === s.route_id);
      if (!r || new Date(s.arrive_at) < new Date()) return false;
      if (from && r.origin_port_id !== from) return false;
      if (to && r.dest_port_id !== to) return false;
      if (date && bkkDateKey(s.depart_at) !== date) return false;
      if (vessel && s.vessel_id !== vessel) return false;
      if (avail === 'open' && (s.status !== 'open' || s.capacity_tons - s.booked_tons <= 0)) return false;
      return s.status !== 'cancelled';
    }).sort((a, b) => a.depart_at.localeCompare(b.depart_at));
  }, [store, from, to, date, vessel, avail]);

  const grouped = useMemo(() => {
    const m = new Map<string, Schedule[]>();
    rows.slice(0, limit).forEach((r) => { const k = bkkDateKey(r.depart_at); m.set(k, [...(m.get(k) || []), r]); });
    return Array.from(m.entries());
  }, [rows, limit]);

  const book = (s: Schedule) => {
    const r = store?.routes.find((x) => x.id === s.route_id);
    if (r) writeDraft({ origin: r.origin_port_id, dest: r.dest_port_id, date: bkkDateKey(s.depart_at), scheduleId: s.id, noSchedule: false, step: 1 });
    router.push('/booking/');
  };
  const hasFilter = from || to || date || vessel || avail !== 'open';
  const portName = (id: string) => { const p = store?.ports.find((x) => x.id === id); return p ? (lang === 'th' ? p.name_th : p.name_en) : ''; };

  return (
    <>
      <PageHeader eyebrow={t('ตารางเดินเรือ', 'Shipping schedule')} title={t('รอบเรือขนส่งสินค้า', 'Cargo sailings')} lead={t('เวลาทั้งหมดเป็นเวลาประเทศไทย ตารางจริงจัดการโดยผู้ดูแลระบบ', 'All times are Thailand time. Real schedules are managed by the administrator.')} />
      <div className="container py-10">
        <div className="card p-4 md:p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-brand-red" />{t('ตัวกรอง', 'Filters')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select aria-label={t('ท่าต้นทาง', 'Departure port')} value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">{t('ท่าต้นทาง: ทั้งหมด', 'From: any port')}</option>
              {store?.ports.map((p) => <option key={p.id} value={p.id}>{portName(p.id)}</option>)}
            </Select>
            <Select aria-label={t('ปลายทาง', 'Destination')} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">{t('ปลายทาง: ทั้งหมด', 'To: any port')}</option>
              {store?.ports.map((p) => <option key={p.id} value={p.id}>{portName(p.id)}</option>)}
            </Select>
            <Input aria-label={t('วันที่ออกเรือ', 'Departure date')} type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} />
            <Select aria-label={t('เรือ', 'Vessel')} value={vessel} onChange={(e) => setVessel(e.target.value)}>
              <option value="">{t('เรือ: ทุกลำ', 'Vessel: any')}</option>
              {store?.vessels.filter((v) => v.status !== 'inactive').map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
            <Select aria-label={t('สถานะ', 'Availability')} value={avail} onChange={(e) => setAvail(e.target.value as 'all' | 'open')}>
              <option value="open">{t('เฉพาะรอบที่ว่าง', 'Available only')}</option>
              <option value="all">{t('ทั้งหมด (รวมเต็ม/ปิด)', 'All (incl. full/closed)')}</option>
            </Select>
          </div>
          {hasFilter && <button onClick={() => { setFrom(''); setTo(''); setDate(''); setVessel(''); setAvail('open'); }} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-red"><X className="h-4 w-4" />{t('ล้างตัวกรอง', 'Clear filters')}</button>}
        </div>

        <div className="mt-8 space-y-10">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
          {!loading && grouped.length === 0 && <EmptyState title={t('ไม่พบรอบเรือตามเงื่อนไข', 'No sailings match your filters')} body={t('ลองเปลี่ยนวันที่หรือเส้นทาง หรือส่งคำขอใบเสนอราคาให้เจ้าหน้าที่จัดรอบให้', 'Try another date or route, or request a quotation and our team will arrange it.')} />}
          {grouped.map(([day, list]) => (
            <section key={day}>
              <h2 className="sticky top-[72px] z-10 -mx-4 mb-3 bg-white/95 px-4 py-2 font-display text-lg font-bold backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">{formatDate(day + 'T12:00:00+07:00', lang)}</h2>
              <div className="space-y-3">{list.map((s) => <SailingRow key={s.id} s={s} store={store!} onBook={() => book(s)} />)}</div>
            </section>
          ))}
          {rows.length > limit && <Button variant="outline" size="lg" className="w-full" onClick={() => setLimit((l) => l + 20)}>{t(`ดูรอบเพิ่มเติม (อีก ${rows.length - limit} รอบ)`, `Show more (${rows.length - limit} more)`)}</Button>}
        </div>
      </div>
    </>
  );
}
