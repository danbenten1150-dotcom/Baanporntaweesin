'use client';

import { useEffect, useMemo, useState } from 'react';
import { BedDouble, CalendarDays, Clock, Minus, Plus, Send, Ship, Users } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import type { SleeperBooking, SleeperDirection } from '@/lib/types';
import { MONTH_EN, MONTH_TH, SLEEPER_DIR, WEEKDAY_EN, WEEKDAY_TH_SHORT, dateLabel, daysLabel, sailingDates, sleeperConfig, weekdayOf } from '@/lib/sleeper';
import { cn, formatTHB } from '@/lib/utils';
import { Alert, Button, Field, Input, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { ContactFields, downloadSummary, ErrorBanner, SuccessPanel, SupportBox, TermsCheck, useContactState, useSubmitError } from '@/components/shared/forms';
import { useSettings } from '@/components/layout/SiteChrome';

export default function View() {
  const { t, lang } = useLang();
  const settings = useSettings();
  const cfg = sleeperConfig(settings);
  const [dir, setDir] = useState<SleeperDirection>('cpn_tao');
  const [date, setDate] = useState('');
  const [names, setNames] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useContactState();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SleeperBooking | null>(null);
  const err = useSubmitError();
  const { data: taken } = useQuery(() => api.sleeperTaken(dir), [dir]);

  useEffect(() => { // /sleeper/#tao_cpn pre-selects the return trip
    const h = location.hash.slice(1); if (h === 'cpn_tao' || h === 'tao_cpn') setDir(h);
  }, []);

  const leg = cfg.legs[dir];
  const dates = useMemo(() => sailingDates(settings, dir, 6), [settings, dir]);
  const left = (d: string) => (leg.berths == null ? null : Math.max(0, leg.berths - (taken?.[d] || 0)));
  const maxPax = Math.min(30, date && left(date) != null ? (left(date) as number) : 30);
  const pax = names.length;
  const total = leg.price != null ? leg.price * pax : null;

  useEffect(() => { setDate(''); }, [dir]);
  useEffect(() => { if (pax > Math.max(1, maxPax)) setNames((n) => n.slice(0, Math.max(1, maxPax))); }, [maxPax, pax]);
  // first passenger defaults to the contact name, so a solo traveller types it once
  useEffect(() => { setNames((n) => (n[0] === '' && contact.full_name ? [contact.full_name, ...n.slice(1)] : n)); }, [contact.full_name]);

  const submit = async () => {
    err.reset(); setBusy(true);
    try {
      const r = await api.createSleeperBooking({ direction: dir, travel_date: date, passengers: names.map((full_name) => ({ full_name })), contact, notes, accept_terms: terms as true });
      setDone(r); window.scrollTo({ top: 0 });
    } catch (e) { err.handle(e); } finally { setBusy(false); }
  };

  const timeText = (l = leg) => (l.depart_time ? `${l.depart_time}${l.arrive_time ? ` → ${l.arrive_time}` : ''}` : t('แจ้งเวลาเมื่อยืนยัน', 'Time given on confirmation'));

  if (settings && !cfg.enabled) return (
    <>
      <PageHeader eyebrow={t('ตั๋วเรือนอน', 'Sleeper boat')} title={t('จองตั๋วเรือนอน ชุมพร ⇄ เกาะเต่า', 'Sleeper boat Chumphon ⇄ Koh Tao')} />
      <div className="container max-w-3xl space-y-6 py-10"><Alert>{t('ขณะนี้ยังไม่เปิดรับจองตั๋วเรือนอนออนไลน์ กรุณาติดต่อเจ้าหน้าที่', 'Online sleeper-boat booking is closed right now — please contact us.')}</Alert><SupportBox /></div>
    </>
  );

  return (
    <>
      <PageHeader eyebrow={t('ตั๋วเรือนอน', 'Sleeper boat tickets')} title={t('จองตั๋วเรือนอน ชุมพร ⇄ เกาะเต่า', 'Sleeper boat Chumphon ⇄ Koh Tao')}
        lead={t('เลือกเที่ยว เลือกวัน ใส่ชื่อผู้โดยสาร แล้วส่ง — เจ้าหน้าที่จะโทรยืนยันที่นั่งและราคา', 'Pick a trip and date, add passengers and send — staff call to confirm berths and fare.')} />
      <div className="container py-10">
        {done ? (
          <div className="mx-auto max-w-3xl">
            <SuccessPanel title={t('ได้รับคำขอจองของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบข้อมูลและติดต่อกลับเพื่อยืนยันการจอง', 'We have your request. Staff will check it and contact you to confirm the booking.')} refNo={done.ref}
              onDownload={() => downloadSummary({ title: t('คำขอจองตั๋วเรือนอน', 'Sleeper boat request'), ref: done.ref, demo: IS_DEMO,
                note: t('ยังไม่ใช่ตั๋วยืนยัน — รอเจ้าหน้าที่ติดต่อกลับเพื่อยืนยันที่นั่งและราคา', 'Not a confirmed ticket yet — staff will contact you to confirm berths and fare.'),
                rows: [
                  { label: t('เที่ยว', 'Trip'), value: lang === 'th' ? SLEEPER_DIR[done.direction].th : SLEEPER_DIR[done.direction].en },
                  { label: t('วันเดินทาง', 'Date'), value: dateLabel(done.travel_date, lang, true) },
                  { label: t('เวลา', 'Time'), value: timeText(cfg.legs[done.direction]) },
                  { label: t('ผู้โดยสาร', 'Passengers'), value: done.passengers.map((p) => p.full_name).join(', ') },
                  { label: t('ราคา', 'Fare'), value: cfg.legs[done.direction].price != null ? `${formatTHB(cfg.legs[done.direction].price! * done.seats, lang)} (${t('ประมาณการ', 'estimate')})` : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting staff price') },
                ] })}>
              <div className="flex items-center gap-2"><span className="text-sm text-neutral-500">{t('สถานะ', 'Status')}:</span><StatusBadge status="pending_review" /></div>
            </SuccessPanel>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <form className="card space-y-9 p-5 md:p-8" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
              {IS_DEMO && <Alert tone="info">{t('โหมดสาธิต: การจองนี้ไม่ใช่การจองจริง', 'Demo mode: this is not a real booking.')}</Alert>}

              <section>
                <h2 className="h2 text-[24px]">{t('1 · เลือกเที่ยวเรือ', '1 · Choose your trip')}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(['cpn_tao', 'tao_cpn'] as SleeperDirection[]).map((k) => {
                    const l = cfg.legs[k]; const on = dir === k;
                    return (
                      <button type="button" key={k} onClick={() => setDir(k)} aria-pressed={on}
                        className={cn('rounded-2xl border-2 p-5 text-left transition', on ? 'border-brand-red bg-red-50/60 ring-2 ring-brand-red/15' : 'border-neutral-200 hover:border-neutral-300')}>
                        <span className="flex items-center gap-2 font-display text-[21px] font-extrabold">
                          <Ship className={cn('h-6 w-6', on ? 'text-brand-red' : 'text-neutral-500')} />
                          {lang === 'th' ? SLEEPER_DIR[k].th : SLEEPER_DIR[k].en}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-[16px] font-semibold text-neutral-800"><CalendarDays className="h-4 w-4 text-brand-red" />{t('ทุกวัน', 'Every')} {daysLabel(l.weekdays, lang)}</span>
                        <span className="mt-1 flex items-center gap-2 text-[15px] text-neutral-600"><Clock className="h-4 w-4" />{timeText(l)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="h2 text-[24px]">{t('2 · เลือกวันเดินทาง', '2 · Choose a date')}</h2>
                <p className="mt-1 text-[15px] text-neutral-600">{t(`แสดงเฉพาะวันที่มีเรือออก (${daysLabel(leg.weekdays, 'th')})`, `Only days with a sailing are shown (${daysLabel(leg.weekdays, 'en')})`)}</p>
                {dates.length === 0 ? <Alert className="mt-4">{t('ยังไม่มีวันที่เปิดจอง กรุณาติดต่อเจ้าหน้าที่', 'No dates open yet — please contact us.')}</Alert> : (
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="radiogroup" aria-label={t('วันเดินทาง', 'Travel date')}>
                    {dates.map((d) => {
                      const n = left(d); const full = n === 0; const on = date === d;
                      return (
                        <button type="button" key={d} role="radio" aria-checked={on} disabled={full} onClick={() => setDate(d)}
                          className={cn('rounded-xl border-2 px-2 py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-45',
                            on ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200 hover:border-brand-red/50')}>
                          <span className="block text-[13px] font-semibold">{lang === 'th' ? WEEKDAY_TH_SHORT[weekdayOf(d)] : WEEKDAY_EN[weekdayOf(d)]}</span>
                          <span className="block font-display text-[22px] font-extrabold leading-tight">{Number(d.slice(8))}</span>
                          <span className="block text-[13px]">{lang === 'th' ? MONTH_TH[Number(d.slice(5, 7)) - 1] : MONTH_EN[Number(d.slice(5, 7)) - 1]}</span>
                          {n != null && <span className={cn('mt-1 block text-[13px] font-semibold', on ? 'text-brand-yellow' : full ? 'text-red-700' : 'text-emerald-700')}>{full ? t('เต็ม', 'Full') : t(`เหลือ ${n}`, `${n} left`)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {err.fields.travel_date && <p className="mt-2 text-[15px] font-medium text-red-700">{t('กรุณาเลือกวันเดินทาง', 'Please choose a date')}</p>}
              </section>

              <section>
                <h2 className="h2 text-[24px]">{t('3 · ผู้โดยสาร', '3 · Passengers')}</h2>
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-[17px] font-semibold">{t('จำนวน', 'Number')}</span>
                  <div className="flex items-center overflow-hidden rounded-xl border border-neutral-300">
                    <button type="button" className="grid h-12 w-12 place-items-center hover:bg-brand-grey disabled:opacity-40" disabled={pax <= 1} onClick={() => setNames(names.slice(0, -1))} aria-label={t('ลดผู้โดยสาร', 'Fewer passengers')}><Minus className="h-5 w-5" /></button>
                    <span className="w-14 text-center font-display text-[22px] font-extrabold" aria-live="polite">{pax}</span>
                    <button type="button" className="grid h-12 w-12 place-items-center hover:bg-brand-grey disabled:opacity-40" disabled={pax >= maxPax} onClick={() => setNames([...names, ''])} aria-label={t('เพิ่มผู้โดยสาร', 'More passengers')}><Plus className="h-5 w-5" /></button>
                  </div>
                  <span className="text-[15px] text-neutral-600">{t('ท่าน', 'people')}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {names.map((n, i) => (
                    <Field key={i} label={t(`ชื่อ-นามสกุล ผู้โดยสารคนที่ ${i + 1}`, `Passenger ${i + 1} full name`)} required error={err.fields[`passengers.${i}.full_name`]}>
                      <Input value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} invalid={!!err.fields[`passengers.${i}.full_name`]} autoComplete={i === 0 ? 'name' : 'off'} />
                    </Field>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="h2 mb-4 text-[24px]">{t('4 · ข้อมูลผู้ติดต่อ', '4 · Contact details')}</h2>
                <ContactFields value={contact} onChange={setContact} errors={err.fields} />
                <Field label={t('หมายเหตุ (ถ้ามี)', 'Notes (optional)')} className="mt-4"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('เช่น มีเด็กเล็ก ต้องการเตียงติดกัน มีสัมภาระเยอะ', 'e.g. small children, berths together, lots of luggage')} /></Field>
              </section>

              <TermsCheck checked={terms} onChange={setTerms} error={err.fields.accept_terms} />
              <ErrorBanner message={err.message} />
              <Button type="submit" size="lg" loading={busy} className="w-full rounded-full text-[18px] sm:w-auto sm:px-10"><Send className="h-5 w-5" />{t('ส่งคำขอจองตั๋ว', 'Send ticket request')}</Button>
            </form>

            <aside className="space-y-5 lg:sticky lg:top-[84px] lg:h-fit xl:top-[80px]">
              <div className="card p-6">
                <h2 className="font-display text-[20px] font-extrabold">{t('สรุปการจอง', 'Your booking')}</h2>
                <dl className="mt-4 space-y-3 text-[16px]">
                  <div><dt className="text-neutral-500">{t('เที่ยว', 'Trip')}</dt><dd className="font-semibold">{lang === 'th' ? SLEEPER_DIR[dir].th : SLEEPER_DIR[dir].en}</dd></div>
                  <div><dt className="text-neutral-500">{t('วันเดินทาง', 'Date')}</dt><dd className="font-semibold">{date ? dateLabel(date, lang, true) : '—'}</dd></div>
                  <div><dt className="text-neutral-500">{t('เวลา', 'Time')}</dt><dd className="font-semibold">{timeText()}</dd></div>
                  <div><dt className="flex items-center gap-1.5 text-neutral-500"><Users className="h-4 w-4" />{t('ผู้โดยสาร', 'Passengers')}</dt><dd className="font-semibold">{pax} {t('ท่าน', 'people')}</dd></div>
                  <div className="border-t pt-3"><dt className="text-neutral-500">{t('ราคา', 'Fare')}</dt>
                    <dd className="font-display text-[22px] font-extrabold text-brand-red">{total != null ? formatTHB(total, lang) : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting staff price')}</dd>
                    {total != null && <p className="text-[14px] text-neutral-600">{formatTHB(leg.price, lang)} × {pax} · {t('ราคาประมาณการ เจ้าหน้าที่ยืนยันอีกครั้ง', 'estimate, confirmed by staff')}</p>}
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl bg-brand-red p-5 text-white">
                <p className="flex items-center gap-2 font-display text-[18px] font-bold"><BedDouble className="h-5 w-5 text-brand-yellow" />{t('ตารางเรือนอน', 'Sleeper timetable')}</p>
                <ul className="mt-3 space-y-2 text-[15px]">
                  {(['cpn_tao', 'tao_cpn'] as SleeperDirection[]).map((k) => (
                    <li key={k}><span className="font-semibold">{lang === 'th' ? SLEEPER_DIR[k].th : SLEEPER_DIR[k].en}</span><br />{daysLabel(cfg.legs[k].weekdays, lang)} · {timeText(cfg.legs[k])}</li>
                  ))}
                </ul>
                {(lang === 'th' ? cfg.note_th : cfg.note_en) && <p className="mt-3 border-t border-white/25 pt-3 text-[14px]">{lang === 'th' ? cfg.note_th : cfg.note_en}</p>}
              </div>
              <SupportBox />
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
