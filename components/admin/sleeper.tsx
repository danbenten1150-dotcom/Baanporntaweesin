'use client';

// Admin: sleeper-boat tickets — requests list, decision dialog, passenger manifest and timetable settings.
import { useMemo, useState } from 'react';
import { BedDouble, Phone, Printer, Plus, Save, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import type { Settings, SleeperBooking, SleeperDirection, SleeperStatus, Store } from '@/lib/types';
import { MACHINERY_STATUS } from '@/lib/labels';
import { SLEEPER_DIR, WEEKDAY_TH, WEEKDAY_EN, bkkToday, dateLabel, daysLabel, sailingDates, seatsTaken, sleeperConfig } from '@/lib/sleeper';
import { cn, escapeHtml, formatDate, formatTHB, printHtml, toCSV, downloadFile } from '@/lib/utils';
import { Alert, Badge, Button, Checkbox, DemoTag, Field, Input, Modal, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { DataTable, Kpi, useAction, useActor } from './kit';

const STATUSES: SleeperStatus[] = ['pending_review', 'confirmed', 'completed', 'cancelled', 'rejected'];
const HOLD = (b: SleeperBooking) => b.status !== 'cancelled' && b.status !== 'rejected';

export function SleeperAdmin({ s, sub, setSub }: { s: Store; sub: string; setSub: (v: string) => void }) {
  const { t } = useLang();
  const tab = ['requests', 'trips', 'settings'].includes(sub) ? sub : 'requests';
  const pending = s.sleeperBookings.filter((b) => b.status === 'pending_review').length;
  return (
    <div className="space-y-5">
      <Tabs value={tab} onChange={setSub} items={[
        { value: 'requests', label: t('คำขอจองตั๋ว', 'Ticket requests'), count: pending },
        { value: 'trips', label: t('รายชื่อผู้โดยสารรายเที่ยว', 'Passenger list by trip') },
        { value: 'settings', label: t('ตารางเรือนอนและราคา', 'Timetable & fares') },
      ]} />
      {tab === 'requests' && <Requests s={s} />}
      {tab === 'trips' && <Trips s={s} />}
      {tab === 'settings' && <SleeperSettingsForm settings={s.settings} />}
    </div>
  );
}

function Requests({ s }: { s: Store }) {
  const { t, lang, pick } = useLang();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => s.sleeperBookings
    .filter((b) => filter === 'all' || (b.status === 'pending_review' || (b.status === 'confirmed' && b.travel_date >= bkkToday())))
    .sort((a, b) => (a.status === 'pending_review' ? 0 : 1) - (b.status === 'pending_review' ? 0 : 1) || a.travel_date.localeCompare(b.travel_date)), [s.sleeperBookings, filter]);
  const cur = s.sleeperBookings.find((b) => b.id === open) || null;
  const today = bkkToday();
  const paxToday = s.sleeperBookings.filter((b) => b.travel_date === today && b.status === 'confirmed').reduce((n, b) => n + b.seats, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={t('รอยืนยัน', 'Awaiting decision')} value={s.sleeperBookings.filter((b) => b.status === 'pending_review').length} tone="warn" onClick={() => setFilter('open')} />
        <Kpi label={t('ผู้โดยสารยืนยันวันนี้', 'Confirmed passengers today')} value={paxToday} />
        <Kpi label={t('คำขอทั้งหมด', 'All requests')} value={s.sleeperBookings.length} onClick={() => setFilter('all')} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'open' ? 'primary' : 'outline'} onClick={() => setFilter('open')}>{t('ต้องจัดการ / เที่ยวที่จะถึง', 'To handle / upcoming')}</Button>
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>{t('ทั้งหมด', 'All')}</Button>
      </div>
      <DataTable rows={rows} onRow={(r) => setOpen(r.id)} empty={t('ยังไม่มีคำขอจองตั๋วเรือนอน', 'No sleeper-boat requests yet')} cols={[
        { label: t('เลขอ้างอิง', 'Ref'), render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
        { label: t('เที่ยว', 'Trip'), render: (r) => <span className="whitespace-nowrap">{lang === 'th' ? SLEEPER_DIR[r.direction].th : SLEEPER_DIR[r.direction].en}</span> },
        { label: t('วันเดินทาง', 'Date'), render: (r) => <span className="whitespace-nowrap">{dateLabel(r.travel_date, lang)}</span> },
        { label: t('ผู้โดยสาร', 'Pax'), render: (r) => <span className="font-semibold">{r.seats}</span> },
        { label: t('ผู้ติดต่อ', 'Contact'), render: (r) => <>{r.contact.full_name}<span className="block text-[13px] text-neutral-500">{r.contact.phone}</span></> },
        { label: t('ราคา', 'Fare'), render: (r) => (r.price != null ? formatTHB(r.price, lang) : <span className="text-neutral-500">{t('ยังไม่ระบุ', 'Not set')}</span>) },
        { label: t('สถานะ', 'Status'), render: (r) => <div className="flex gap-1"><StatusBadge status={r.status} />{r.is_demo && <DemoTag />}</div> },
      ]} />
      {cur && <Decision key={cur.id} b={cur} s={s} onClose={() => setOpen(null)} pick={pick} />}
    </div>
  );
}

function Decision({ b, s, onClose, pick }: { b: SleeperBooking; s: Store; onClose: () => void; pick: (l: { th: string; en: string }) => string }) {
  const { t, lang } = useLang();
  const act = useAction();
  const actor = useActor();
  const cfg = sleeperConfig(s.settings);
  const leg = cfg.legs[b.direction];
  const suggested = b.price ?? (leg.price != null ? leg.price * b.seats : null);
  const [price, setPrice] = useState(suggested == null ? '' : String(suggested));
  const [note, setNote] = useState('');
  const held = seatsTaken(s.sleeperBookings, b.direction, b.travel_date);
  const priceVal = price === '' ? null : Number(price);
  const save = (status: SleeperStatus, msg: string) => act(() => api.setSleeperStatus(b.id, status, priceVal, note, actor), msg).then((ok) => ok && onClose());
  return (
    <Modal open onClose={onClose} title={b.ref} wide>
      <div className="space-y-5 text-[15px]">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} />{b.is_demo && <DemoTag />}<span className="text-neutral-500">{t('ส่งเมื่อ', 'Sent')} {formatDate(b.created_at, lang, true)}</span></div>
        <div className="grid gap-4 rounded-2xl bg-brand-grey p-4 sm:grid-cols-3">
          <div><p className="text-neutral-500">{t('เที่ยว', 'Trip')}</p><p className="font-semibold">{lang === 'th' ? SLEEPER_DIR[b.direction].th : SLEEPER_DIR[b.direction].en}</p></div>
          <div><p className="text-neutral-500">{t('วันเดินทาง', 'Date')}</p><p className="font-semibold">{dateLabel(b.travel_date, lang, true)}</p></div>
          <div><p className="text-neutral-500">{t('ที่นอนรอบนี้', 'Berths this trip')}</p><p className="font-semibold">{leg.berths != null ? t(`จองแล้ว ${held} / ${leg.berths}`, `${held} of ${leg.berths} held`) : t(`จองแล้ว ${held} (ยังไม่ตั้งจำนวนเตียง)`, `${held} held (berths not set)`)}</p></div>
        </div>
        <div>
          <p className="font-semibold">{t(`ผู้โดยสาร ${b.seats} ท่าน`, `${b.seats} passenger(s)`)}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-6">{b.passengers.map((p, i) => <li key={i}>{p.full_name}{p.nationality ? ` · ${p.nationality}` : ''}</li>)}</ol>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p><span className="text-neutral-500">{t('ผู้ติดต่อ', 'Contact')}:</span> <strong>{b.contact.full_name}</strong>{b.contact.line_id ? ` · LINE ${b.contact.line_id}` : ''}{b.contact.email ? ` · ${b.contact.email}` : ''}</p>
          <a href={`tel:${b.contact.phone}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 font-semibold text-white"><Phone className="h-4 w-4" />{b.contact.phone}</a>
        </div>
        {b.notes && <Alert tone="info">{b.notes}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ราคารวมของการจองนี้ (บาท)', 'Total fare for this booking (THB)')} hint={leg.price != null ? t(`ราคาตั้งไว้ ${formatTHB(leg.price, 'th')} × ${b.seats} ท่าน`, `Set fare ${formatTHB(leg.price, 'en')} × ${b.seats}`) : t('ยังไม่ได้ตั้งราคาต่อท่าน — ใส่ราคาที่แจ้งลูกค้า', 'No per-person fare set — enter what you quoted')}>
            <Input type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label={t('หมายเหตุถึงลูกค้า (แสดงในหน้าติดตาม)', 'Note to customer (shown when tracking)')}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('เช่น ขึ้นเรือที่ท่าเรือ… ก่อนเวลา 30 นาที', 'e.g. board at … 30 min early')} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {b.status === 'pending_review' && <>
            <Button onClick={() => save('confirmed', t('ยืนยันการจองแล้ว', 'Booking confirmed'))}>{t('ยืนยันการจอง', 'Confirm booking')}</Button>
            <Button variant="danger" onClick={() => save('rejected', t('ปฏิเสธคำขอแล้ว', 'Request rejected'))}>{t('ปฏิเสธ (ที่นั่งเต็ม/ไม่มีเรือ)', 'Reject')}</Button>
          </>}
          {b.status === 'confirmed' && <>
            <Button onClick={() => save('completed', t('บันทึกว่าเดินทางแล้ว', 'Marked as travelled'))}>{t('เดินทางแล้ว', 'Travelled')}</Button>
            <Button variant="danger" onClick={() => save('cancelled', t('ยกเลิกแล้ว', 'Cancelled'))}>{t('ยกเลิกการจอง', 'Cancel booking')}</Button>
          </>}
          <Button variant="outline" onClick={() => save(b.status, t('บันทึกแล้ว', 'Saved'))}><Save className="h-4 w-4" />{t('บันทึกราคา/หมายเหตุ', 'Save fare/note')}</Button>
          <Select className="w-auto" aria-label={t('เปลี่ยนสถานะ', 'Change status')} value="" onChange={(e) => e.target.value && save(e.target.value as SleeperStatus, t('เปลี่ยนสถานะแล้ว', 'Status changed'))}>
            <option value="">{t('เปลี่ยนสถานะอื่น…', 'Other status…')}</option>
            {STATUSES.filter((x) => x !== b.status).map((x) => <option key={x} value={x}>{pick(MACHINERY_STATUS[x])}</option>)}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

/** Upcoming trips with seat counts and a printable passenger manifest. */
function Trips({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const cfg = sleeperConfig(s.settings);
  const trips = (['cpn_tao', 'tao_cpn'] as SleeperDirection[]).flatMap((dir) => {
    const dates = new Set([...sailingDates(s.settings, dir, 4), ...s.sleeperBookings.filter((b) => b.direction === dir && b.travel_date >= bkkToday()).map((b) => b.travel_date)]);
    return [...dates].map((date) => ({ dir, date, list: s.sleeperBookings.filter((b) => b.direction === dir && b.travel_date === date && HOLD(b)) }));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.dir.localeCompare(b.dir));

  const manifest = (dir: SleeperDirection, date: string, list: SleeperBooking[]) => {
    const rows = list.filter((b) => b.status === 'confirmed' || b.status === 'completed').flatMap((b) => b.passengers.map((p) => ({ ...p, ref: b.ref, phone: b.contact.phone })));
    const title = `${SLEEPER_DIR[dir].th} · ${dateLabel(date, 'th', true)}`;
    const body = `<h1>รายชื่อผู้โดยสารเรือนอน</h1><p><strong>${escapeHtml(title)}</strong> · ${rows.length} ท่าน (เฉพาะที่ยืนยันแล้ว)</p>
      <table><thead><tr><th>#</th><th>ชื่อ-นามสกุล</th><th>เลขอ้างอิง</th><th>เบอร์ติดต่อ</th><th>ลงชื่อขึ้นเรือ</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.full_name)}</td><td>${escapeHtml(r.ref)}</td><td>${escapeHtml(r.phone)}</td><td></td></tr>`).join('')}
      </tbody></table>`;
    printHtml(`manifest-${dir}-${date}.html`, `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#171717}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #999;padding:8px;text-align:left;font-size:14px}th{background:#f3f3f3}td:last-child{width:120px}</style>
      </head><body>${body}</body></html>`);
  };
  const csv = (dir: SleeperDirection, date: string, list: SleeperBooking[]) => {
    const rows = list.flatMap((b) => b.passengers.map((p) => ({ trip: SLEEPER_DIR[dir].th, date, ref: b.ref, status: b.status, passenger: p.full_name, contact: b.contact.full_name, phone: b.contact.phone })));
    downloadFile(`sleeper-${dir}-${date}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
  };

  if (!trips.length) return <Alert tone="info">{t('ยังไม่มีเที่ยวที่จะถึง — ตรวจวันเดินเรือในแท็บ “ตารางเรือนอนและราคา”', 'No upcoming trips — check sailing days in “Timetable & fares”.')}</Alert>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {trips.map(({ dir, date, list }) => {
        const confirmed = list.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((n, b) => n + b.seats, 0);
        const pending = list.filter((b) => b.status === 'pending_review').reduce((n, b) => n + b.seats, 0);
        const berths = cfg.legs[dir].berths;
        return (
          <div key={dir + date} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-display text-[18px] font-bold">{dateLabel(date, lang, true)}</p><p className="text-neutral-600">{lang === 'th' ? SLEEPER_DIR[dir].th : SLEEPER_DIR[dir].en}{cfg.legs[dir].depart_time ? ` · ${cfg.legs[dir].depart_time}` : ''}</p></div>
              {cfg.closed_dates.includes(date) && <Badge tone="bad">{t('ปิดรอบนี้', 'Closed')}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[14px]">
              <Badge tone="ok">{t(`ยืนยัน ${confirmed} ท่าน`, `${confirmed} confirmed`)}</Badge>
              {pending > 0 && <Badge tone="warn">{t(`รอยืนยัน ${pending} ท่าน`, `${pending} pending`)}</Badge>}
              <Badge>{berths != null ? t(`ว่าง ${Math.max(0, berths - confirmed - pending)} / ${berths}`, `${Math.max(0, berths - confirmed - pending)} of ${berths} free`) : t('ยังไม่ตั้งจำนวนเตียง', 'Berths not set')}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={!confirmed} onClick={() => manifest(dir, date, list)}><Printer className="h-4 w-4" />{t('พิมพ์รายชื่อ', 'Print list')}</Button>
              <Button size="sm" variant="ghost" disabled={!list.length} onClick={() => csv(dir, date, list)}>CSV</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SleeperSettingsForm({ settings }: { settings: Settings }) {
  const { t, lang } = useLang();
  const act = useAction();
  const [c, setC] = useState(() => sleeperConfig(settings));
  const [closeDate, setCloseDate] = useState('');
  const setLeg = (dir: SleeperDirection, patch: Partial<Settings['sleeper']['legs'][SleeperDirection]>) => setC({ ...c, legs: { ...c.legs, [dir]: { ...c.legs[dir], ...patch } } });
  const num = (v: string) => (v === '' ? null : Math.max(0, Number(v)));
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); act(() => api.saveSettings({ ...settings, sleeper: c }), t('บันทึกตารางเรือนอนแล้ว', 'Sleeper timetable saved')); }}>
      <Checkbox checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })}>{t('เปิดรับจองตั๋วเรือนอนออนไลน์', 'Accept sleeper-boat bookings online')}</Checkbox>
      <div className="grid gap-5 lg:grid-cols-2">
        {(['cpn_tao', 'tao_cpn'] as SleeperDirection[]).map((dir) => {
          const l = c.legs[dir];
          return (
            <section key={dir} className="card space-y-4 p-5">
              <h3 className="flex items-center gap-2 font-display text-[20px] font-bold"><BedDouble className="h-5 w-5 text-brand-red" />{lang === 'th' ? SLEEPER_DIR[dir].th : SLEEPER_DIR[dir].en}</h3>
              <div>
                <p className="mb-2 text-sm font-medium">{t('วันที่เรือออก', 'Sailing days')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = l.weekdays.includes(d);
                    return <button type="button" key={d} aria-pressed={on} onClick={() => setLeg(dir, { weekdays: on ? l.weekdays.filter((x) => x !== d) : [...l.weekdays, d] })}
                      className={cn('h-11 rounded-xl border-2 px-3 text-[15px] font-semibold', on ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200')}>{lang === 'th' ? WEEKDAY_TH[d] : WEEKDAY_EN[d]}</button>;
                  })}
                </div>
                <p className="mt-1.5 text-[14px] text-neutral-600">{t('ตอนนี้:', 'Now:')} {daysLabel(l.weekdays, lang) || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('เวลาออก', 'Departs')} hint={t('เว้นว่าง = แจ้งเมื่อยืนยัน', 'blank = given on confirmation')}><Input type="time" value={l.depart_time} onChange={(e) => setLeg(dir, { depart_time: e.target.value })} /></Field>
                <Field label={t('เวลาถึง (ประมาณ)', 'Arrives (approx.)')}><Input type="time" value={l.arrive_time} onChange={(e) => setLeg(dir, { arrive_time: e.target.value })} /></Field>
                <Field label={t('จำนวนเตียงต่อเที่ยว', 'Berths per trip')} hint={t('เว้นว่าง = ไม่จำกัด เจ้าหน้าที่ตรวจเอง', 'blank = no limit, staff check')}><Input type="number" min={0} value={l.berths ?? ''} onChange={(e) => setLeg(dir, { berths: num(e.target.value) })} /></Field>
                <Field label={t('ราคาต่อท่าน (บาท)', 'Fare per person (THB)')} hint={t('เว้นว่าง = “รอเจ้าหน้าที่ยืนยันราคา”', 'blank = “awaiting staff price”')}><Input type="number" min={0} value={l.price ?? ''} onChange={(e) => setLeg(dir, { price: num(e.target.value) })} /></Field>
              </div>
            </section>
          );
        })}
      </div>
      <section className="card space-y-3 p-5">
        <h3 className="font-display text-[18px] font-bold">{t('ปิดรอบเป็นวัน ๆ (คลื่นลม วันหยุด เรือซ่อม)', 'Close specific dates (weather, holidays, repairs)')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('วันที่', 'Date')}><Input type="date" min={bkkToday()} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></Field>
          <Button type="button" variant="outline" disabled={!closeDate} onClick={() => { if (!c.closed_dates.includes(closeDate)) setC({ ...c, closed_dates: [...c.closed_dates, closeDate].sort() }); setCloseDate(''); }}><Plus className="h-4 w-4" />{t('เพิ่มวันปิด', 'Add closed date')}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.closed_dates.filter((d) => d >= bkkToday()).map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-red-50 py-1 pl-3 pr-1 text-[15px] font-semibold text-red-800">{dateLabel(d, lang, true)}
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full hover:bg-red-100" aria-label={t('เอาออก', 'Remove')} onClick={() => setC({ ...c, closed_dates: c.closed_dates.filter((x) => x !== d) })}><Trash2 className="h-4 w-4" /></button></span>
          ))}
          {!c.closed_dates.some((d) => d >= bkkToday()) && <p className="text-[15px] text-neutral-500">{t('ไม่มีวันปิด', 'No closed dates')}</p>}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('ข้อความแจ้งลูกค้า (ไทย)', 'Customer note (Thai)')}><Textarea rows={3} value={c.note_th} onChange={(e) => setC({ ...c, note_th: e.target.value })} placeholder="เช่น กรุณามาถึงท่าเรือก่อนเวลา 30 นาที" /></Field>
        <Field label={t('ข้อความแจ้งลูกค้า (อังกฤษ)', 'Customer note (English)')}><Textarea rows={3} value={c.note_en} onChange={(e) => setC({ ...c, note_en: e.target.value })} /></Field>
      </div>
      <Button type="submit" size="lg"><Save className="h-5 w-5" />{t('บันทึกตารางเรือนอน', 'Save sleeper timetable')}</Button>
    </form>
  );
}
