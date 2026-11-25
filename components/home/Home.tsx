'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Anchor, ArrowRight, BellRing, CalendarDays, ClipboardCheck, Construction, FileText, HardHat, Layers, MapPin, MousePointerClick,
  BedDouble, ChevronRight, Forklift, Package, PackageSearch, Phone, Send, Ship, Truck,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { CARGO_CATEGORY } from '@/lib/labels';
import { formatTHB, todayKey } from '@/lib/utils';
import { SLEEPER_DIR, WEEKDAY_EN, WEEKDAY_TH_SHORT, sleeperConfig } from '@/lib/sleeper';

const daysShort = (w: number[], lang: 'th' | 'en') => [1, 2, 3, 4, 5, 6, 0].filter((d) => w.includes(d)).map((d) => (lang === 'th' ? WEEKDAY_TH_SHORT[d] : WEEKDAY_EN[d])).join(' ');
import { newDraftItem, writeDraft } from '@/lib/draft';
import type { CargoCategory } from '@/lib/types';
import { Button, DemoTag, LinkButton, Select, Input } from '@/components/ui';
import { LineIcon, useSettings } from '@/components/layout/SiteChrome';

// ───────── 1. Hero — flat brand red, very large type, one yellow highlight, pill buttons ─────────
export function HeroSection() {
  const { t, lang } = useLang();
  const s = useSettings();
  const custom = lang === 'th' ? s?.hero_title_th : s?.hero_title_en;
  const isDefault = !custom || custom === 'เชื่อมทุกการขนส่ง สร้างทุกความเป็นไปได้' || custom === 'Connecting Every Destination. Building Every Possibility.';
  return (
    <section className="relative overflow-hidden bg-brand-red text-white">
      {/* diagonal yellow / white bands on the right, like the banner */}
      <svg className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[46%] lg:block" viewBox="0 0 600 700" preserveAspectRatio="none" aria-hidden>
        <path d="M250 0 L600 0 L600 700 L0 700Z" fill="#a80000" />
        <path d="M330 0 L400 0 L120 700 L50 700Z" fill="#FFD600" />
        <path d="M420 0 L445 0 L165 700 L140 700Z" fill="#ffffff" opacity=".9" />
      </svg>
      <div className="container relative grid items-center gap-8 py-10 md:py-14 lg:grid-cols-[1.15fr_1fr] lg:py-16">
        <div>
          {isDefault ? (
            <h1 className="font-display font-extrabold leading-[1.08] tracking-tight">
              <span className="block text-[40px] sm:text-[60px] lg:text-[74px]">{t('เชื่อมทุกการขนส่ง', 'Connecting every')}</span>
              <span className="block text-[30px] text-brand-yellow sm:text-[50px] lg:text-[60px]">{t('สร้างทุกความเป็นไปได้', 'destination & build')}</span>
            </h1>
          ) : <h1 className="font-display text-[40px] font-extrabold leading-[1.1] sm:text-[56px]">{custom}</h1>}
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3 font-display text-[24px] font-bold leading-snug sm:text-[32px]">
            {t('ชุมพร', 'Chumphon')} <span className="text-[40px] font-extrabold leading-none text-brand-yellow sm:text-[56px]">⇄</span> {t('เกาะเต่า · เกาะพะงัน', 'Koh Tao · Koh Phangan')}
          </p>
          <p className="mt-2 text-[18px] font-semibold text-white sm:text-[22px]">{t('ขนส่งทางเรือ · วัสดุก่อสร้าง · รถเครน · รับเหมา ครบในที่เดียว', 'Sea freight · materials · cranes · contracting — all in one place')}</p>
          <div className="mt-8 grid gap-3 sm:flex">
            <LinkButton href="/booking/" variant="white" size="lg" className="w-full rounded-full px-9 text-[19px] font-extrabold text-brand-ink sm:w-auto"><Ship className="h-6 w-6 text-brand-red" />{t('จองเรือขนส่ง', 'Book cargo')}</LinkButton>
            <LinkButton href="/quote/" variant="accent" size="lg" className="w-full rounded-full px-9 text-[19px] font-extrabold sm:w-auto"><FileText className="h-5 w-5" />{t('ขอใบเสนอราคา', 'Get a quote')}</LinkButton>
          </div>
          <Link href="/sleeper/" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white/70 px-6 text-[17px] font-bold text-white transition hover:bg-white hover:text-brand-red">
            <BedDouble className="h-5 w-5" />{t('จองตั๋วเรือนอน ชุมพร ⇄ เกาะเต่า', 'Sleeper boat tickets Chumphon ⇄ Koh Tao')}
          </Link>
          <p className="mt-4 text-[15px] text-white">{t('ไม่ต้องสมัครสมาชิก · เจ้าหน้าที่โทรยืนยันทุกการจอง', 'No account needed · we call to confirm every booking')}</p>
        </div>
        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] shadow-2xl ring-[6px] ring-white">
            {s?.hero_image_url
              ? <img src={s.hero_image_url} alt={t('ภาพหน้าแรกของบ้านพรทวีสิน', 'Baan PornTaweesin')} width={1200} height={900} fetchPriority="high" className="h-full w-full object-cover" />
              : <img src="/images/banner-truck-crane.webp" srcSet="/images/banner-truck-crane-480.webp 480w, /images/banner-truck-crane.webp 610w" sizes="(max-width: 640px) 92vw, 560px"
                  alt={t('รถบรรทุกและรถเครนของบ้านพรทวีสิน', 'Baan PornTaweesin truck and crane')} width={610} height={560} fetchPriority="high" className="h-full w-full object-cover object-[60%_50%]" />}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── 2. Services — line icons, bold titles, short lines, a small red rule ─────────
const QUICK = [
  { href: '/booking/', icon: Ship, th: 'ขนส่งสินค้าทางเรือ', en: 'Sea freight', l: [['ชุมพร ⇄ เกาะเต่า', 'Chumphon ⇄ Koh Tao'], ['ชุมพร ⇄ เกาะพะงัน', 'Chumphon ⇄ Koh Phangan'], ['สินค้า รถยนต์ เครื่องจักร', 'Cargo, vehicles, machinery']] },
  { href: '/sleeper/', icon: BedDouble, th: 'ตั๋วเรือนอน', en: 'Sleeper boat', l: [['ชุมพร → เกาะเต่า อ. พฤ. ส.', 'Chumphon → Tao: Tue Thu Sat'], ['เกาะเต่า → ชุมพร จ. พ. ศ.', 'Tao → Chumphon: Mon Wed Fri'], ['จองออนไลน์ ไม่ต้องสมัคร', 'Book online, no account']] },
  { href: '/materials/', icon: Layers, th: 'วัสดุก่อสร้าง', en: 'Building materials', l: [['หิน ปูน ทราย', 'Stone, cement, sand'], ['ท่อ บ่อ อิฐ เหล็ก', 'Pipes, rings, bricks, steel'], ['ส่งถึงหน้างานบนเกาะ', 'Delivered to island sites']] },
  { href: '/machinery/#crane', icon: Construction, th: 'บริการรถเครน', en: 'Crane service', l: [['ยก-ขนย้ายของหนัก', 'Heavy lifting'], ['ท่อ บ่อ โครงเหล็ก', 'Pipes, rings, steel'], ['พร้อมพนักงานควบคุม', 'With operator']] },
  { href: '/machinery/#dump_truck', icon: Truck, th: 'รถดัมพ์และเครื่องจักร', en: 'Trucks & machinery', l: [['รถดัมพ์ขนวัสดุ', 'Dump trucks'], ['รถแบคโฮ เครื่องจักรหนัก', 'Excavators, heavy plant'], ['รายชั่วโมง / รายวัน', 'Hourly or daily']] },
  { href: '/construction/', icon: HardHat, th: 'รับเหมาก่อสร้าง', en: 'Construction', l: [['บ้าน อาคาร รีโนเวท', 'Houses, buildings, renovation'], ['ฐานราก งานคอนกรีต', 'Foundations, concrete'], ['ดูหน้างานก่อนเสนอราคา', 'Site visit before quoting']] },
];
export function QuickServices() {
  const { t } = useLang();
  return (
    <section className="bg-white py-12 md:py-16" aria-labelledby="qs-title">
      <div className="container">
        <h2 id="qs-title" className="text-center font-display text-[28px] font-extrabold md:text-[36px]">{t('บริการของเรา', 'Our services')}</h2>
        <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-brand-red" aria-hidden />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="group flex flex-col items-center rounded-2xl px-2 py-3 text-center transition hover:bg-brand-grey">
              <q.icon className="h-16 w-16 text-brand-red transition group-hover:scale-105 md:h-20 md:w-20" strokeWidth={1.6} />
              <h3 className="mt-4 font-display text-[19px] font-extrabold md:text-[23px]">{t(q.th, q.en)}</h3>
              <ul className="mt-2 space-y-1 text-[15px] text-neutral-700 md:text-[17px]">{q.l.map(([th, en]) => <li key={th}>{t(th, en)}</li>)}</ul>
              <span className="mt-4 h-[3px] w-12 rounded-full bg-brand-red" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Why us — photo left, solid red panel right ─────────
export function WhyUsSplit() {
  const { t } = useLang();
  const points = [
    ['ขนส่งทางเรือ วัสดุ รถ และงานก่อสร้าง ติดต่อที่เดียว', 'Shipping, materials, trucks and building — one contact'],
    ['จองออนไลน์ได้ตลอด ไม่ต้องสมัครสมาชิก', 'Book online any time, no account needed'],
    ['เจ้าหน้าที่ตรวจสอบและโทรยืนยันทุกการจอง', 'Staff check and call to confirm every booking'],
    ['ใบเสนอราคาแจกแจงชัดเจน ตอบรับได้ออนไลน์', 'Clear, itemised quotations you accept online'],
    ['ไป-กลับ ชุมพร เกาะเต่า เกาะพะงัน', 'Both ways: Chumphon, Koh Tao, Koh Phangan'],
    ['ติดตามสถานะได้ด้วยเลขอ้างอิงและเบอร์โทร', 'Track progress with your reference and phone'],
  ];
  return (
    <section className="bg-brand-grey py-12 md:py-16">
      <div className="container">
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-card lg:grid-cols-2">
          <div className="flex items-center p-4 md:p-6">
            <img src="/brand/banner-alt.webp" alt={t('แบนเนอร์บ้านพรทวีสิน: จำหน่ายหิน ปูน ทราย ท่อบ่อ บริการรถดัมพ์ รถเครน เครื่องจักร', 'Baan PornTaweesin banner')} width={1400} height={467} loading="lazy" className="h-auto w-full rounded-2xl" />
          </div>
          <div className="bg-brand-red p-7 text-white md:p-10">
            <p className="text-center font-display text-[22px] font-bold md:text-[26px]">{t('ทำไมลูกค้าเลือกใช้บริการ', 'Why customers choose')}</p>
            <p className="banner-type mt-2 text-center text-[34px] md:text-[44px]">บ้าน<span className="text-brand-yellow">พรทวีสิน</span></p>
            <ul className="mt-6 space-y-3.5">
              {points.map(([th, en]) => (
                <li key={th} className="flex gap-3 text-[17px] md:text-[18px]"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-brand-red"><ChevronRight className="h-4 w-4" strokeWidth={3} /></span>{t(th, en)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── How to book + rate table (prices only when set by the admin) ─────────
export function HowToAndRates() {
  const { t, lang } = useLang();
  const { data: store } = useQuery(() => api.getStore(), []);
  const steps = [
    ['เลือกเส้นทางและวันที่', 'Choose route & date'], ['ใส่รายละเอียดสินค้า', 'Describe the cargo'],
    ['ใส่ชื่อและเบอร์โทร แล้วกดส่ง', 'Name, phone, send'], ['รอเจ้าหน้าที่โทรยืนยัน', 'We call to confirm'],
  ];
  const routes = (store?.routes || []).filter((r) => r.active);
  const sail7 = (id: string) => (store?.schedules || []).filter((x) => x.route_id === id && x.status === 'open' && new Date(x.depart_at) > new Date() && new Date(x.depart_at).getTime() < Date.now() + 7 * 864e5).length;
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="container grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-center font-display text-[26px] font-extrabold md:text-[32px]">{t('วิธีจองเรือขนส่ง', 'How to book')}</h2>
          <div className="mt-6 rounded-3xl bg-brand-red p-3 md:p-4">
            <div className="rounded-2xl bg-white p-6 md:p-8">
              <p className="text-center font-display text-[34px] font-extrabold leading-tight text-brand-red md:text-[44px]">{t('จองง่าย', 'Easy booking')}</p>
              <p className="text-center font-display text-[26px] font-extrabold md:text-[32px]">{t('แค่ 4 ขั้นตอน', 'in 4 steps')}</p>
              <ol className="mt-6 space-y-3">
                {steps.map(([th, en], i) => (
                  <li key={th} className="flex items-center gap-4 rounded-2xl bg-brand-grey p-3.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-red font-display text-[20px] font-extrabold text-white">{i + 1}</span>
                    <span className="text-[18px] font-semibold">{t(th, en)}</span>
                  </li>
                ))}
              </ol>
              <LinkButton href="/booking/" size="lg" className="mt-6 w-full rounded-full text-[18px] font-extrabold"><Ship className="h-5 w-5" />{t('เริ่มจองเรือ', 'Start booking')}</LinkButton>
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-center font-display text-[26px] font-extrabold md:text-[32px]">{t('ค่าบริการขนส่งทางเรือ', 'Sea freight rates')}</h2>
          <div className="mt-6 overflow-hidden rounded-2xl shadow-card ring-1 ring-neutral-200">
            {routes.map((r) => {
              const n = sail7(r.id);
              return (
                <div key={r.id}>
                  <p className="bg-brand-red px-5 py-3.5 font-display text-[18px] font-bold text-white md:text-[20px]">{lang === 'th' ? r.name_th : r.name_en}</p>
                  <dl className="grid grid-cols-3 bg-brand-grey text-center">
                    <div className="border-r border-white p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('ราคา/ตัน', 'Per tonne')}</dt><dd className="mt-0.5 text-[17px] font-bold">{r.rate_per_ton != null ? formatTHB(r.rate_per_ton, lang).replace('.00', '') : t('สอบถามราคา', 'Ask us')}</dd></div>
                    <div className="border-r border-white p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('เวลาเดินเรือ', 'Crossing')}</dt><dd className="mt-0.5 text-[17px] font-bold">{r.duration_min ? t(`~${Math.round(r.duration_min / 60 * 10) / 10} ชม.`, `~${Math.round(r.duration_min / 60 * 10) / 10} h`) : t('แจ้งเมื่อยืนยัน', 'On confirmation')}</dd></div>
                    <div className="p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('รอบว่าง 7 วัน', 'Open in 7 days')}</dt><dd className="mt-0.5 text-[17px] font-bold">{n ? `${n} ${t('รอบ', 'sailings')}` : t('สอบถาม', 'Ask us')}</dd></div>
                  </dl>
                </div>
              );
            })}
            {(['cpn_tao', 'tao_cpn'] as const).map((k) => { const l = sleeperConfig(store?.settings).legs[k]; return (
              <div key={k}>
                <p className="flex items-center gap-2 bg-brand-dark px-5 py-3.5 font-display text-[18px] font-bold text-white md:text-[20px]"><BedDouble className="h-5 w-5 text-brand-yellow" />{t('เรือนอน', 'Sleeper')} {lang === 'th' ? SLEEPER_DIR[k].th : SLEEPER_DIR[k].en}</p>
                <dl className="grid grid-cols-3 bg-brand-grey text-center">
                  <div className="border-r border-white p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('ราคา/ท่าน', 'Per person')}</dt><dd className="mt-0.5 text-[17px] font-bold">{l.price != null ? formatTHB(l.price, lang).replace('.00', '') : t('สอบถามราคา', 'Ask us')}</dd></div>
                  <div className="border-r border-white p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('วันเรือออก', 'Days')}</dt><dd className="mt-0.5 text-[16px] font-bold">{daysShort(l.weekdays, lang)}</dd></div>
                  <div className="p-3"><dt className="text-[14px] font-semibold text-neutral-600">{t('เวลาออก', 'Departs')}</dt><dd className="mt-0.5 text-[17px] font-bold">{l.depart_time || t('แจ้งเมื่อยืนยัน', 'On confirmation')}</dd></div>
                </dl>
              </div>
            ); })}
            <p className="bg-brand-red px-5 py-3.5 font-display text-[18px] font-bold text-white md:text-[20px]">{t('รถเครน · รถดัมพ์ · เครื่องจักร · วัสดุก่อสร้าง', 'Cranes · trucks · machinery · materials')}</p>
            <div className="flex items-center justify-between gap-3 bg-brand-grey px-5 py-4"><span className="text-[16px]">{t('ราคาขึ้นกับงานและปริมาณ', 'Depends on job and quantity')}</span><LinkButton href="/quote/" variant="outline" size="sm" className="rounded-full">{t('ขอใบเสนอราคา', 'Get a quote')}</LinkButton></div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[14px] text-neutral-600">{store?.schedules.some((x) => x.is_demo) && <DemoTag />}{t('ราคาจริงยืนยันโดยเจ้าหน้าที่ในใบเสนอราคา · ราคาแสดงเมื่อผู้ดูแลตั้งค่าแล้ว', 'Final price is in the staff quotation · rates show once set by the admin')}</p>
        </div>
      </div>
    </section>
  );
}

// ───────── 3. Quick booking ─────────
export function QuickBookingSection() {
  const { t, lang, pick } = useLang();
  const router = useRouter();
  const { data: s } = useQuery(() => api.getStore(), []);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [date, setDate] = useState(todayKey());
  const [cargo, setCargo] = useState<CargoCategory>('general');
  const [err, setErr] = useState('');
  const pname = (id: string) => { const p = s?.ports.find((x) => x.id === id); return p ? (lang === 'th' ? p.name_th : p.name_en) : ''; };
  const origins = useMemo(() => Array.from(new Set((s?.routes || []).filter((r) => r.active).map((r) => r.origin_port_id))), [s]);
  const dests = useMemo(() => (s?.routes || []).filter((r) => r.active && (!origin || r.origin_port_id === origin)).map((r) => r.dest_port_id), [s, origin]);

  const start = () => {
    if (!origin || !dest) { setErr(t('กรุณาเลือกต้นทางและปลายทาง', 'Please choose where from and where to')); return; }
    writeDraft({ origin, dest, date, scheduleId: '', step: 0, items: [newDraftItem(cargo)] });
    router.push('/booking/');
  };
  return (
    <section className="py-10 md:py-14" aria-labelledby="qb-title">
      <div className="container">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-card md:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-red text-white"><Ship className="h-6 w-6" /></span>
            <div>
              <h2 id="qb-title" className="banner-type text-[24px] text-brand-red [text-shadow:none] md:text-[30px]">{t('จองเรือด่วน', 'Quick booking')}</h2>
              <p className="text-neutral-600">{t('เลือก 4 อย่าง แล้วกดเริ่มจอง', 'Choose four things, then start')}</p>
            </div>
          </div>
          <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end" onSubmit={(e) => { e.preventDefault(); start(); }}>
            <label className="block"><span className="mb-1.5 flex items-center gap-2 text-base font-medium"><Anchor className="h-5 w-5 text-brand-red" />{t('ต้นทาง', 'From')}</span>
              <Select value={origin} onChange={(e) => { setOrigin(e.target.value); setDest(''); setErr(''); }} className="h-14 text-[17px]">
                <option value="">{t('เลือกท่าเรือต้นทาง', 'Departure port')}</option>
                {origins.map((id) => <option key={id} value={id}>{pname(id)}</option>)}
              </Select></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-2 text-base font-medium"><MapPin className="h-5 w-5 text-brand-red" />{t('ปลายทาง', 'To')}</span>
              <Select value={dest} onChange={(e) => { setDest(e.target.value); setErr(''); }} className="h-14 text-[17px]" disabled={!origin}>
                <option value="">{origin ? t('เลือกปลายทาง', 'Destination') : t('เลือกต้นทางก่อน', 'Choose “from” first')}</option>
                {dests.map((id) => <option key={id} value={id}>{pname(id)}</option>)}
              </Select></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-2 text-base font-medium"><CalendarDays className="h-5 w-5 text-brand-red" />{t('วันที่ต้องการขนส่ง', 'Shipping date')}</span>
              <Input type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} className="h-14 text-[17px]" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-2 text-base font-medium"><Package className="h-5 w-5 text-brand-red" />{t('ประเภทสินค้า', 'Cargo type')}</span>
              <Select value={cargo} onChange={(e) => setCargo(e.target.value as CargoCategory)} className="h-14 text-[17px]">
                {Object.entries(CARGO_CATEGORY).map(([k, v]) => <option key={k} value={k}>{pick(v)}</option>)}
              </Select></label>
            <Button type="submit" size="lg" className="h-14 w-full text-lg xl:w-auto">{t('เริ่มจองเรือ', 'Start booking')}<ArrowRight className="h-5 w-5" /></Button>
          </form>
          {err && <p className="mt-3 text-[15px] font-medium text-red-600" role="alert">{err}</p>}
        </div>
      </div>
    </section>
  );
}

// ───────── 5. How it works ─────────
export function HowItWorks() {
  const { t } = useLang();
  const steps = [
    { icon: MousePointerClick, th: 'เลือกบริการ', en: 'Choose a service', dth: 'จองเรือ สั่งวัสดุ หรือขอราคางานก่อสร้าง', den: 'Ship, materials or construction' },
    { icon: Send, th: 'ส่งข้อมูลการจอง', en: 'Send your details', dth: 'กรอกข้อมูลสั้น ๆ ไม่ต้องสมัครสมาชิก', den: 'A short form, no account needed' },
    { icon: ClipboardCheck, th: 'รอเจ้าหน้าที่ยืนยัน', en: 'We confirm', dth: 'เจ้าหน้าที่ตรวจสอบและติดต่อกลับพร้อมราคา', den: 'Our team checks and calls you with a price' },
    { icon: BellRing, th: 'รับบริการและติดตามสถานะ', en: 'Track progress', dth: 'ดูสถานะได้ด้วยเลขอ้างอิงและเบอร์โทร', den: 'Follow it with your reference and phone' },
  ];
  return (
    <section className="red-field relative overflow-hidden py-12 text-white md:py-16" aria-labelledby="how-title">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden><path d="M900 420 C 1100 330, 1260 350, 1450 230" stroke="#FFD600" strokeWidth="10" fill="none" /></svg>
      <div className="container relative">
        <p className="text-[15px] font-semibold text-brand-yellow">{t('ขั้นตอนง่าย ๆ', 'Simple steps')}</p>
        <h2 id="how-title" className="banner-type mt-1 text-[30px] md:text-[38px]">{t('ใช้บริการง่าย ๆ ใน 4 ขั้นตอน', 'Four easy steps')}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="relative rounded-2xl bg-white p-6 text-brand-ink shadow-xl">
              <span className="banner-type absolute right-5 top-3 text-5xl text-brand-yellow [text-shadow:0_2px_0_#b39500]" aria-hidden>{i + 1}</span>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-red text-white"><s.icon className="h-7 w-7" /></span>
              <h3 className="mt-4 text-lg font-bold"><span className="sr-only">{i + 1}. </span>{t(s.th, s.en)}</h3>
              <p className="mt-1.5 text-neutral-600">{t(s.dth, s.den)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ───────── 7. Contact & support ─────────
export function ContactSupport() {
  const { t } = useLang();
  const s = useSettings();
  const cards = [
    { href: s?.phone ? `tel:${s.phone}` : '/contact/#phone', icon: Phone, th: 'โทรหาเรา', en: 'Call us', sub: s?.phone || t('ดูเบอร์ที่หน้าติดต่อเรา', 'See contact page'), cls: 'bg-brand-red text-white border-brand-red' },
    { href: s?.line_url || '/contact/#line', icon: LineIcon, th: 'ติดต่อผ่าน LINE', en: 'Chat on LINE', sub: s?.line_id || 'LINE', cls: 'bg-[#06783A] text-white border-[#06783A]', ext: !!s?.line_url },
    { href: '/quote/', icon: FileText, th: 'ขอใบเสนอราคา', en: 'Request a quote', sub: t('ตอบกลับโดยเจ้าหน้าที่', 'Answered by our team'), cls: 'bg-white text-brand-ink border-neutral-200 hover:border-brand-red' },
    { href: s?.map_url || '/contact/#address', icon: MapPin, th: 'ดูตำแหน่งบริษัท', en: 'Find us on the map', sub: t('เปิดแผนที่', 'Open map'), cls: 'bg-white text-brand-ink border-neutral-200 hover:border-brand-red', ext: !!s?.map_url },
  ];
  return (
    <section className="py-12 md:py-16" aria-labelledby="support-title">
      <div className="container">
        <h2 id="support-title" className="banner-type text-[28px] text-brand-red [text-shadow:none] md:text-[36px]">{t('มีคำถาม? คุยกับเราได้เลย', 'Questions? Talk to us')}</h2>
        <p className="mt-2 text-lg text-neutral-600">{t('เจ้าหน้าที่พร้อมช่วยเลือกบริการและเสนอราคา', 'Our team will help you choose and quote')}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <a key={c.th} href={c.href} target={c.ext ? '_blank' : undefined} rel="noreferrer" className={`flex min-h-[88px] items-center gap-4 rounded-2xl border p-5 transition hover:shadow-card ${c.cls}`}>
              <c.icon className="h-8 w-8 shrink-0" />
              <span><span className="block text-lg font-bold">{t(c.th, c.en)}</span><span className="block text-[15px] opacity-85">{c.sub}</span></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
