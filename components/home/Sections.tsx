'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Building2, CalendarClock, ChevronLeft, ChevronRight, Construction, FileSpreadsheet, Forklift,
  HardHat, Layers, MapPinned, Route as RouteIcon, Ship, Truck, Workflow,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import type { GalleryCategory } from '@/lib/types';
import { writeDraft } from '@/lib/draft';
import { DemoTag } from '@/components/ui';
import { buttonClass, LinkButton, PhotoSlot } from '@/components/ui';
import { cn } from '@/lib/utils';

export const SERVICES = [
  { id: 'marine', icon: Ship, th: 'ขนส่งสินค้าทางทะเล', en: 'Marine Cargo Transportation',
    dth: 'เรือขนส่งสินค้า วัสดุก่อสร้าง และยานพาหนะ ระหว่างชุมพร เกาะเต่า และเกาะพะงัน จองออนไลน์ได้ทันที',
    den: 'Cargo, construction materials and vehicles between Chumphon, Koh Tao and Koh Phangan — book online.',
    img: null, detail: '/services/#marine', action: '/booking/', ath: 'จองเรือ', aen: 'Book now' },
  { id: 'contractor', icon: HardHat, th: 'รับเหมาก่อสร้าง', en: 'Construction Contractor',
    dth: 'งานก่อสร้างที่พักอาศัย อาคาร งานฐานราก งานคอนกรีต และงานปรับปรุง ตั้งแต่สำรวจหน้างานจนส่งมอบ',
    den: 'Residential and commercial builds, foundations, concrete and renovation — from site survey to handover.',
    img: null, detail: '/services/#contractor', action: '/construction/', ath: 'ขอใบเสนอราคา', aen: 'Get a quote' },
  { id: 'materials', icon: Layers, th: 'จำหน่ายวัสดุก่อสร้าง', en: 'Construction Materials',
    dth: 'หิน ปูน ทราย ท่อคอนกรีต บ่อคอนกรีต อิฐ และเหล็ก พร้อมบริการจัดส่งถึงหน้างานบนเกาะ',
    den: 'Stone, cement, sand, concrete pipes and rings, bricks and steel, delivered to island sites.',
    img: '/images/banner-materials.webp', detail: '/services/#materials', action: '/materials/', ath: 'เลือกสินค้า', aen: 'Shop materials' },
  { id: 'truck', icon: Truck, th: 'บริการรถดัมพ์และรถขนส่ง', en: 'Truck Transportation',
    dth: 'รถดัมพ์และรถบรรทุกสำหรับขนส่งวัสดุก่อสร้าง ดิน หิน ทราย ทั้งบนฝั่งและบนเกาะ',
    den: 'Dump trucks and lorries moving materials, soil, stone and sand on the mainland and islands.',
    img: null, detail: '/services/#truck', action: '/machinery/', ath: 'จองรถ', aen: 'Book a truck' },
  { id: 'crane', icon: Construction, th: 'บริการรถเครน', en: 'Crane Services',
    dth: 'รถเครนยก-ขนย้าย สินค้าหนัก ท่อ บ่อ โครงสร้างเหล็ก และเครื่องจักร พร้อมพนักงานควบคุม',
    den: 'Crane trucks for lifting heavy cargo, pipes, rings, steel and machinery, with operators.',
    img: '/images/banner-truck-crane.webp', detail: '/services/#crane', action: '/machinery/', ath: 'จองรถเครน', aen: 'Book a crane' },
  { id: 'machinery', icon: Forklift, th: 'บริการเครื่องจักรหนัก', en: 'Heavy Machinery Rental',
    dth: 'รถแบคโฮ เครื่องจักรงานดิน และการขนย้ายเครื่องจักรหนักข้ามเกาะ เช่ารายชั่วโมงหรือรายวัน',
    den: 'Excavators, earth-moving equipment and inter-island machinery transport, hourly or daily.',
    img: null, detail: '/services/#machinery', action: '/machinery/', ath: 'ขอเช่าเครื่องจักร', aen: 'Request rental' },
];

export function useServiceImage() {
  const { data } = useQuery(() => api.getSettings(), []);
  return (s: (typeof SERVICES)[number]) => data?.service_images?.[s.id] || s.img;
}

export function ServicesSection({ heading = true }: { heading?: boolean }) {
  const { t, lang } = useLang();
  const img = useServiceImage();
  return (
    <section className="section bg-white" id="services">
      <div className="container">
        {heading && (
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">{t('บริการของเรา', 'Our services')}</p>
              <h2 className="h2 mt-3">{t('บริการครบวงจร ตั้งแต่ท่าเรือถึงหน้างาน', 'End-to-end, from the pier to your site')}</h2>
            </div>
            <p className="lead max-w-md">{t('ขนส่ง วัสดุ เครื่องจักร และงานก่อสร้าง ประสานงานโดยทีมเดียว', 'Transport, materials, machinery and construction — coordinated by one team.')}</p>
          </div>
        )}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <article key={s.id} className="group card flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
              <div className="relative aspect-[16/10] overflow-hidden">
                <PhotoSlot src={img(s)} alt={lang === 'th' ? s.th : s.en} label={lang === 'th' ? s.th : s.en} icon={s.icon} className="transition duration-500 group-hover:scale-[1.03]" />
                <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-red text-white shadow-lg"><s.icon className="h-5 w-5" /></span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl font-bold">{lang === 'th' ? s.th : s.en}</h3>
                <p className="mt-1 text-sm font-medium text-neutral-500">{lang === 'th' ? s.en : s.th}</p>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-neutral-600">{lang === 'th' ? s.dth : s.den}</p>
                <div className="mt-6 flex gap-2">
                  <Link href={s.detail} className={buttonClass('outline', 'md', 'flex-1')}>{t('ดูรายละเอียด', 'View details')}</Link>
                  <Link href={s.action} className={buttonClass('primary', 'md', 'flex-1')}>{lang === 'th' ? s.ath : s.aen}</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const PORT_POS = { cpn: { x: 120, y: 170 }, kto: { x: 470, y: 120 }, kpg: { x: 560, y: 330 } };
const ROUTES = [
  { id: 'r-cpn-kto', from: 'cpn', to: 'kto', th: 'ชุมพร → เกาะเต่า', en: 'Chumphon → Koh Tao', path: 'M128 168 C 250 100, 360 90, 462 118' },
  { id: 'r-kto-cpn', from: 'kto', to: 'cpn', th: 'เกาะเต่า → ชุมพร', en: 'Koh Tao → Chumphon', path: 'M462 128 C 360 140, 250 150, 128 178' },
  { id: 'r-cpn-kpg', from: 'cpn', to: 'kpg', th: 'ชุมพร → เกาะพะงัน', en: 'Chumphon → Koh Phangan', path: 'M126 178 C 200 300, 400 360, 550 332' },
  { id: 'r-kpg-cpn', from: 'kpg', to: 'cpn', th: 'เกาะพะงัน → ชุมพร', en: 'Koh Phangan → Chumphon', path: 'M552 322 C 420 300, 230 260, 132 182' },
] as const;

export function RouteMap() {
  const { t, lang } = useLang();
  const { data: store } = useQuery(() => api.getStore(), []);
  // availability is shown only when real sailings have been configured for that route
  const avail = (routeId: string) => {
    const list = (store?.schedules || []).filter((x) => x.route_id === routeId && x.status !== 'cancelled' && new Date(x.depart_at) > new Date());
    if (!list.length) return null;
    const week = list.filter((x) => x.status === 'open' && x.capacity_tons > x.booked_tons && new Date(x.depart_at).getTime() < Date.now() + 7 * 86400_000);
    return { n: week.length, demo: list.some((x) => x.is_demo) };
  };
  const pick = (id: string) => { const r = store?.routes.find((x) => x.id === id); if (r) writeDraft({ origin: r.origin_port_id, dest: r.dest_port_id, scheduleId: '', step: 0 }); };
  const [sel, setSel] = useState<string>('r-cpn-kto');
  const [dir, setDir] = useState<'out' | 'ret'>('out');
  const visible = ROUTES.filter((r) => (dir === 'out' ? r.from === 'cpn' : r.to === 'cpn'));
  useEffect(() => { if (!visible.some((v) => v.id === sel)) setSel(visible[0].id); }, [dir]); // eslint-disable-line
  const current = ROUTES.find((r) => r.id === sel)!;
  const portName = { cpn: t('ชุมพร', 'Chumphon'), kto: t('เกาะเต่า', 'Koh Tao'), kpg: t('เกาะพะงัน', 'Koh Phangan') };

  return (
    <section className="bg-white py-12 md:py-16" id="routes">
      <div className="container grid items-center gap-10 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <p className="eyebrow">{t('เส้นทางเดินเรือ', 'Shipping routes')}</p>
          <h2 className="h2 mt-2">{t('เส้นทางเดินเรือขนส่ง', 'Shipping routes')}</h2>
          <p className="lead mt-4">{t('เลือกเส้นทางเพื่อดูตารางเดินเรือ จองพื้นที่บรรทุก หรือขอใบเสนอราคาค่าขนส่ง', 'Pick a route to see sailings, book cargo space or request a freight quotation.')}</p>
          <div className="mt-6 inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-neutral-200" role="radiogroup" aria-label={t('ทิศทาง', 'Direction')}>
            {(['out', 'ret'] as const).map((d) => (
              <button key={d} role="radio" aria-checked={dir === d} onClick={() => setDir(d)}
                className={cn('h-10 rounded-lg px-4 text-sm font-semibold', dir === d ? 'bg-brand-red text-white' : 'text-neutral-600')}>
                {d === 'out' ? t('ขาไป (จากชุมพร)', 'Outbound (from Chumphon)') : t('ขากลับ (สู่ชุมพร)', 'Return (to Chumphon)')}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2.5">
            {visible.map((r) => { const a = avail(r.id); return (
              <button key={r.id} onClick={() => setSel(r.id)} aria-pressed={sel === r.id}
                className={cn('flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition', sel === r.id ? 'border-brand-red bg-red-50/40' : 'border-neutral-200 bg-white hover:border-neutral-300')}>
                <span className="flex items-center gap-3">
                  <RouteIcon className={cn('h-6 w-6 shrink-0', sel === r.id ? 'text-brand-red' : 'text-neutral-500')} />
                  <span><span className="block text-[17px] font-semibold">{lang === 'th' ? r.th : r.en}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-600">
                      {a ? <>{t(`${a.n} รอบที่ว่างใน 7 วันข้างหน้า`, `${a.n} open sailings in the next 7 days`)}{a.demo && <DemoTag />}</> : t('ติดต่อเจ้าหน้าที่เพื่อจัดรอบ', 'Ask our team to arrange a sailing')}
                    </span></span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-neutral-500" />
              </button>
            ); })}
          </div>
          <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
            <LinkButton href="/booking/" variant="primary" onClick={() => pick(sel)}><Ship className="h-5 w-5" />{t('จองเส้นทางนี้', 'Book this route')}</LinkButton>
            <LinkButton href="/schedule/" variant="outline"><CalendarClock className="h-5 w-5" />{t('ดูตารางเดินเรือ', 'View schedule')}</LinkButton>
            <LinkButton href="/quote/" variant="ghost"><FileSpreadsheet className="h-5 w-5" />{t('ขอใบเสนอราคาค่าขนส่ง', 'Freight quotation')}</LinkButton>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-[#0b3a5b] shadow-lift">
          <svg viewBox="0 0 680 440" className="block h-auto w-full" role="img" aria-label={t(`แผนที่เส้นทาง ${current.th}`, `Route map ${current.en}`)}>
            <defs>
              <pattern id="waves" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 Q10 4 20 10 T40 10" stroke="#ffffff" strokeOpacity=".06" fill="none" /></pattern>
              <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0f4c75" /><stop offset="1" stopColor="#082f4a" /></linearGradient>
            </defs>
            <rect width="680" height="440" fill="url(#sea)" /><rect width="680" height="440" fill="url(#waves)" />
            {/* mainland (schematic) */}
            <path d="M0 0 H110 C 140 60, 90 120, 120 170 C 150 230, 70 300, 100 360 C 120 400, 90 420, 100 440 H0Z" fill="#2f5d3a" />
            <path d="M0 0 H104 C 132 60, 84 120, 114 170 C 144 230, 64 300, 94 360 C 114 400, 84 420, 94 440 H0Z" fill="#3c7449" />
            <text x="24" y="40" fill="#fff" fillOpacity=".55" fontSize="13" fontWeight="600">{t('แผ่นดินใหญ่', 'Mainland')}</text>
            {/* islands */}
            <ellipse cx="478" cy="118" rx="26" ry="20" fill="#3c7449" stroke="#5f9a6c" strokeWidth="2" />
            <path d="M540 312 C 560 290, 610 296, 616 330 C 620 366, 572 378, 548 360 C 530 346, 528 326, 540 312Z" fill="#3c7449" stroke="#5f9a6c" strokeWidth="2" />
            <text x="620" y="420" fill="#fff" fillOpacity=".45" fontSize="12" textAnchor="end">{t('อ่าวไทย · แผนผังโดยประมาณ ไม่ใช่มาตราส่วนจริง', 'Gulf of Thailand · schematic, not to scale')}</text>
            {/* routes */}
            {ROUTES.map((r) => {
              const on = r.id === sel; const shown = visible.some((v) => v.id === r.id);
              return (
                <g key={r.id} onClick={() => { if (!shown) setDir(dir === 'out' ? 'ret' : 'out'); setSel(r.id); }} className="cursor-pointer">
                  <path d={r.path} stroke="transparent" strokeWidth="22" fill="none" />
                  <path d={r.path} stroke={on ? '#FFD600' : '#ffffff'} strokeOpacity={on ? 1 : shown ? 0.35 : 0.12} strokeWidth={on ? 4 : 2.5} fill="none" className={on ? 'route-line' : ''} strokeLinecap="round" />
                </g>
              );
            })}
            {/* ports */}
            {(Object.keys(PORT_POS) as (keyof typeof PORT_POS)[]).map((k) => {
              const p = PORT_POS[k]; const hot = current.from === k || current.to === k;
              const labelLeft = k !== 'kto';
              const tx = k === 'cpn' ? 158 : labelLeft ? p.x - 22 : p.x + 22;
              const ty = k === 'cpn' ? p.y - 50 : p.y + 6;
              return (
                <g key={k}>
                  <circle cx={p.x} cy={p.y} r={hot ? 16 : 11} fill={hot ? '#C00000' : '#ffffff'} fillOpacity={hot ? 1 : 0.9} stroke="#FFD600" strokeWidth={hot ? 4 : 0} />
                  <circle cx={p.x} cy={p.y} r="4" fill={hot ? '#FFD600' : '#C00000'} />
                  <g transform={`translate(${tx}, ${ty})`}>
                    <rect x={labelLeft ? -150 : 0} y="-22" width="150" height="42" rx="10" fill="#ffffff" />
                    <text x={labelLeft ? -75 : 75} y="7" textAnchor="middle" fontSize="22" fontWeight="700" fill="#171717">{portName[k]}</text>
                  </g>
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-4 text-white">
            <p className="flex items-center gap-2 font-semibold"><MapPinned className="h-5 w-5 text-brand-yellow" />{lang === 'th' ? current.th : current.en}</p>
            <Link href="/booking/" onClick={() => pick(current.id)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-yellow hover:underline">{t('จองเส้นทางนี้', 'Book this route')}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhyUs() {
  const { t } = useLang();
  const items = [
    { icon: Workflow, th: 'บริการขนส่งและก่อสร้างแบบครบวงจร', en: 'Integrated transport & construction', dth: 'วัสดุ เรือ รถ และทีมก่อสร้าง ประสานงานในที่เดียว', den: 'Materials, ships, trucks and builders coordinated in one place.' },
    { icon: Ship, th: 'จองออนไลน์สะดวก', en: 'Convenient online booking', dth: 'เลือกเส้นทาง วันที่ และส่งรายละเอียดสินค้าได้ตลอด 24 ชั่วโมง', den: 'Choose route, date and send cargo details any time.' },
    { icon: BadgeCheck, th: 'ประสานงานอย่างมืออาชีพ', en: 'Professional coordination', dth: 'เจ้าหน้าที่ตรวจสอบและยืนยันทุกการจองก่อนดำเนินการ', den: 'Staff review and confirm every booking before work starts.' },
    { icon: FileSpreadsheet, th: 'ใบเสนอราคาโปร่งใส', en: 'Transparent quotations', dth: 'แจกแจงรายการชัดเจน ตอบรับหรือปฏิเสธได้ออนไลน์', den: 'Itemised quotes you can accept or decline online.' },
    { icon: RouteIcon, th: 'หลายเส้นทางขนส่ง', en: 'Multiple routes', dth: 'ชุมพร–เกาะเต่า และชุมพร–เกาะพะงัน ทั้งขาไปและขากลับ', den: 'Chumphon–Koh Tao and Chumphon–Koh Phangan, both ways.' },
    { icon: MapPinned, th: 'ติดตามสถานะการขนส่ง', en: 'Shipment status tracking', dth: 'ตรวจสอบสถานะด้วยเลขอ้างอิงและเบอร์โทรศัพท์', den: 'Check progress with your reference and phone number.' },
  ];
  return (
    <section className="section bg-brand-ink text-white" id="why">
      <div className="container">
        <div className="max-w-2xl">
          <p className="eyebrow !text-brand-yellow">{t('ทำไมต้องบ้านพรทวีสิน', 'Why Baan PornTaweesin')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight md:text-[42px]">{t('ทีมเดียว ดูแลตั้งแต่ขนส่งจนถึงการก่อสร้าง', 'One team, from shipping to building')}</h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.en} className="bg-brand-ink p-7 transition hover:bg-white/[0.03]">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-red"><i.icon className="h-6 w-6 text-brand-yellow" /></span>
              <h3 className="mt-5 font-display text-lg font-semibold">{t(i.th, i.en)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{t(i.dth, i.den)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const GALLERY = [
  { id: 'cargo', th: 'การขนส่งสินค้า', en: 'Cargo transportation', icon: Ship },
  { id: 'fleet', th: 'เรือและกองเรือ', en: 'Ships & fleet', icon: Ship },
  { id: 'machinery', th: 'เครื่องจักรหนัก', en: 'Heavy machinery', icon: Forklift },
  { id: 'projects', th: 'โครงการก่อสร้าง', en: 'Construction projects', icon: Building2 },
  { id: 'delivery', th: 'การจัดส่งวัสดุ', en: 'Material delivery', icon: Truck },
];

export function Gallery() {
  const { t, lang } = useLang();
  const [cat, setCat] = useState('cargo');
  const ref = useRef<HTMLDivElement>(null);
  const c = GALLERY.find((g) => g.id === cat)!;
  const { data: store } = useQuery(() => api.getStore(), []);
  // Admin-uploaded photos for this category, plus vessel photos under "fleet"; placeholders until real photos exist
  const real = [
    ...(store?.settings.gallery || []).filter((g) => g.category === (cat as GalleryCategory)).map((g) => ({ src: g.url, cap: lang === 'th' ? g.caption_th : g.caption_en })),
    ...(cat === 'fleet' ? (store?.vessels || []).filter((v) => v.photo_url && !v.is_demo).map((v) => ({ src: v.photo_url as string, cap: v.name })) : []),
  ];
  const fallback = cat === 'machinery' ? '/images/banner-truck-crane.webp' : cat === 'delivery' ? '/images/banner-materials.webp' : null;
  const imgs: { src: string | null; cap: string; banner?: boolean }[] = real.length ? real : [{ src: fallback, cap: '', banner: !!fallback }, { src: null, cap: '' }, { src: null, cap: '' }, { src: null, cap: '' }];
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  return (
    <section className="border-t border-neutral-200 bg-white py-12 md:py-16" id="gallery">
      <div className="container">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">{t('ผลงานและภาพการทำงาน', 'Project gallery')}</p>
            <h2 className="h2 mt-3">{t('แกลเลอรีผลงาน', 'Our work')}</h2>
            
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(-1)} className="grid h-11 w-11 place-items-center rounded-xl border hover:border-brand-red" aria-label={t('ก่อนหน้า', 'Previous')}><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => scroll(1)} className="grid h-11 w-11 place-items-center rounded-xl border hover:border-brand-red" aria-label={t('ถัดไป', 'Next')}><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto" role="tablist">
          {GALLERY.map((g) => (
            <button key={g.id} role="tab" aria-selected={cat === g.id} onClick={() => setCat(g.id)}
              className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-medium transition', cat === g.id ? 'bg-brand-red text-white' : 'bg-neutral-100 hover:bg-neutral-200')}>{t(g.th, g.en)}</button>
          ))}
        </div>
        <div ref={ref} className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          onKeyDown={(e) => { if (e.key === 'ArrowRight') scroll(1); if (e.key === 'ArrowLeft') scroll(-1); }} tabIndex={0} aria-label={t('แกลเลอรีภาพ', 'Photo gallery')}>
          {imgs.map((im, i) => (
            <figure key={cat + i} className="relative aspect-[4/3] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[46%] lg:w-[31.5%]">
              <PhotoSlot src={im.src} alt={im.cap || `${t(c.th, c.en)} ${i + 1}`} label={`${t(c.th, c.en)} ${i + 1}`} icon={c.icon} />
              {(im.cap || im.banner) && <figcaption className="absolute bottom-3 left-3 max-w-[85%] rounded-md bg-black/60 px-2 py-1 text-xs text-white">{im.cap || t('ภาพจากแบนเนอร์บริษัท', 'From company banner')}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  const { t } = useLang();
  return (
    <section className="relative overflow-hidden bg-brand-yellow">
      <div className="container flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-brand-ink md:text-3xl">{t('มีสินค้าต้องส่งไปเกาะ หรือมีโครงการก่อสร้าง?', 'Shipping to the islands or planning a build?')}</h2>
          <p className="mt-2 text-brand-ink/75">{t('ส่งรายละเอียดมาได้เลย เจ้าหน้าที่จะติดต่อกลับพร้อมใบเสนอราคา', 'Send us the details — our team will reply with a quotation.')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/booking/" variant="primary" size="lg">{t('จองเรือขนส่ง', 'Book cargo')}</LinkButton>
          <LinkButton href="/quote/" variant="dark" size="lg">{t('ขอใบเสนอราคา', 'Request a quote')}</LinkButton>
        </div>
      </div>
    </section>
  );
}
