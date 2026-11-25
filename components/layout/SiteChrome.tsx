'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock, ChevronDown, ChevronRight, Construction, Globe, HardHat, Headphones, Home, LayoutDashboard, LayoutGrid, Layers, LogIn,
  Mail, MapPin, Menu, MessageCircle, PackageSearch, Phone, Ship, ShieldCheck, ShoppingCart, Truck, User, X,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { api, useQuery } from '@/lib/data';
import { IS_DEMO, SITE } from '@/lib/config';
import { cn } from '@/lib/utils';
import { buttonClass } from '@/components/ui';

/** Main navigation — six items; extra services live under “บริการของเรา”. */
export const NAV = [
  { href: '/', th: 'หน้าแรก', en: 'Home' },
  { href: '/booking/', th: 'จองเรือขนส่ง', en: 'Book Cargo' },
  { href: '/services/', th: 'บริการของเรา', en: 'Services', menu: true },
  { href: '/track/', th: 'ติดตามสถานะ', en: 'Track' },
  { href: '/about/', th: 'เกี่ยวกับเรา', en: 'About' },
  { href: '/contact/', th: 'ติดต่อเรา', en: 'Contact' },
];
export const SERVICE_LINKS = [
  { href: '/booking/', icon: Ship, th: 'จองเรือขนส่งสินค้า', en: 'Book cargo shipping', dth: 'ชุมพร ⇄ เกาะเต่า / เกาะพะงัน', den: 'Chumphon ⇄ Koh Tao / Koh Phangan' },
  { href: '/schedule/', icon: CalendarClock, th: 'ตารางเดินเรือ', en: 'Shipping schedule', dth: 'ดูรอบเรือที่ว่าง', den: 'See open sailings' },
  { href: '/materials/', icon: Layers, th: 'สั่งวัสดุก่อสร้าง', en: 'Order materials', dth: 'หิน ปูน ทราย ท่อ บ่อ เหล็ก', den: 'Stone, cement, sand, pipes, steel' },
  { href: '/construction/', icon: HardHat, th: 'รับเหมาก่อสร้าง', en: 'Construction work', dth: 'ขอประเมินราคาฟรี', den: 'Request a quotation' },
  { href: '/machinery/#crane', icon: Construction, th: 'จองรถเครน', en: 'Book a crane', dth: 'ยก-ขนย้ายของหนัก', den: 'Heavy lifting' },
  { href: '/machinery/#dump_truck', icon: Truck, th: 'รถดัมพ์และเครื่องจักร', en: 'Trucks & machinery', dth: 'รถดัมพ์ แบคโฮ เครื่องจักรหนัก', den: 'Dump trucks, excavators' },
];

export function useSettings() {
  return useQuery(() => api.getSettings(), []).data;
}

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn('grid h-11 w-[56px] shrink-0 place-items-center rounded-xl', light ? 'bg-black/15 ring-1 ring-white/25' : 'bg-brand-red')}>
        {/* Original logo, unaltered — cut from the supplied company banner */}
        <img src="/brand/logo-sm.png" alt="" className="h-[32px] w-[53px] max-w-none object-contain" width={53} height={32} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={cn('block whitespace-nowrap font-display text-[18px] font-bold sm:text-[19px]', light ? 'text-white' : 'text-brand-ink')}>
            บ้าน<span className={light ? 'text-brand-yellow' : 'text-brand-red'}>พรทวีสิน</span>
          </span>
          <span className={cn('mt-1 block text-[13px] font-semibold', light ? 'text-white' : 'text-neutral-600')}>{SITE.name_en}</span>
        </span>
      )}
    </span>
  );
}

function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <>
      {/* phones: one compact toggle */}
      <button onClick={() => setLang(lang === 'th' ? 'en' : 'th')} className={cn('grid h-11 min-w-[44px] place-items-center rounded-xl px-2 text-sm font-bold sm:hidden', dark ? 'bg-white/15 text-white' : 'bg-brand-grey text-brand-ink')}
        aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}>{lang === 'th' ? 'EN' : 'ไทย'}</button>
      <div className={cn('hidden items-center rounded-xl p-1 text-sm font-bold sm:flex', dark ? 'bg-black/15' : 'bg-brand-grey')} role="group" aria-label="ภาษา / Language">
        <Globe className={cn('mx-1.5 h-4 w-4', dark ? 'text-white/85' : 'text-neutral-500')} aria-hidden />
        {(['th', 'en'] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
            className={cn('h-9 min-w-[40px] rounded-lg px-2 uppercase transition', lang === l ? 'bg-white text-brand-red shadow-sm' : dark ? 'text-white/90' : 'text-neutral-600')}>{l}</button>
        ))}
      </div>
    </>
  );
}

function ServicesMenu({ active }: { active: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true"
        className={cn('flex h-11 items-center gap-1 whitespace-nowrap rounded-xl px-4 text-[17px] font-semibold transition hover:bg-white/10', active || open ? 'text-brand-yellow' : 'text-white')}>
        {t('บริการของเรา', 'Services')}<ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-[52px] z-50 w-[560px] -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
          <div className="grid grid-cols-2 gap-1">
            {SERVICE_LINKS.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-start gap-3 rounded-xl p-3 hover:bg-brand-grey">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-brand-red"><s.icon className="h-5 w-5" /></span>
                <span><span className="block font-semibold text-brand-ink">{t(s.th, s.en)}</span><span className="block text-sm text-neutral-500">{t(s.dth, s.den)}</span></span>
              </Link>
            ))}
          </div>
          <Link href="/services/" className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-brand-grey p-3 text-sm font-semibold text-brand-red">{t('ดูบริการทั้งหมด', 'All services')}<ChevronRight className="h-4 w-4" /></Link>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t, lang } = useLang();
  const { user, isStaff } = useAuth();
  const { count } = useCart();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === '/' ? path === '/' : !!path?.startsWith(href.replace(/\/$/, '')));
  const announcement = settings ? (lang === 'th' ? settings.announcement_th : settings.announcement_en) : '';
  const servicesActive = ['/services', '/schedule', '/materials', '/construction', '/machinery', '/cart'].some((p) => path?.startsWith(p));

  return (
    <>
      {IS_DEMO && (
        <p className="no-print bg-brand-ink px-4 py-1.5 text-center text-[13px] font-medium text-brand-yellow">
          {t('โหมดสาธิต — ข้อมูลเรือ ตารางเดินเรือ และการจองเป็นข้อมูลตัวอย่าง ไม่ใช่การจองจริง', 'Demo mode — vessels, schedules and bookings are sample data, not real reservations')}
        </p>
      )}
      {announcement && <div className="bg-brand-yellow px-4 py-2 text-center text-[15px] font-medium text-brand-ink">{announcement}</div>}
      {/* Desktop tier 1 — centred logo on white, like a printed letterhead */}
      <div className="hidden border-b border-neutral-200 bg-white xl:block">
        <div className="container grid h-[104px] grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-5 text-[15px] text-neutral-700">
            <a href={settings?.phone ? `tel:${settings.phone}` : '/contact/#phone'} className="flex items-center gap-2 hover:text-brand-red"><Phone className="h-[18px] w-[18px] text-brand-red" />{settings?.phone || t('โทรหาเรา', 'Call us')}</a>
            <a href={settings?.line_url || '/contact/#line'} className="flex items-center gap-2 hover:text-brand-red"><MessageCircle className="h-[18px] w-[18px] text-brand-red" />{settings?.line_id ? `LINE ${settings.line_id}` : 'LINE'}</a>
          </div>
          <Link href="/" aria-label={`${SITE.name_th} — ${t('หน้าแรก', 'Home')}`} className="flex flex-col items-center">
            <span className="grid h-[58px] w-[92px] place-items-center rounded-2xl bg-brand-red shadow-md"><img src="/brand/logo-sm.png" alt="" width={72} height={44} className="h-[44px] w-[72px] max-w-none object-contain" /></span>
            <span className="banner-type mt-1 text-[22px] leading-none text-brand-ink [text-shadow:none]">บ้าน<span className="text-brand-red">พรทวีสิน</span></span>
          </Link>
          <div className="flex items-center justify-end gap-1">
            <LangSwitch />
            <Link href="/cart/" className="relative grid h-11 w-11 place-items-center rounded-xl text-brand-ink hover:bg-brand-grey" aria-label={t(`ตะกร้าสินค้า ${count} รายการ`, `Cart, ${count} items`)}>
              <ShoppingCart className="h-[22px] w-[22px]" />
              {count > 0 && <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[13px] font-bold text-white">{count}</span>}
            </Link>
            {isStaff && <Link href="/admin/" className="flex h-11 items-center gap-1.5 rounded-xl px-3 font-medium hover:bg-brand-grey"><ShieldCheck className="h-5 w-5 text-brand-red" />{t('หลังบ้าน', 'Admin')}</Link>}
            <Link href={user ? '/account/' : '/login/'} className="flex h-11 items-center gap-1.5 rounded-xl px-3 font-medium hover:bg-brand-grey">
              {user ? <User className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}<span className="max-w-[130px] truncate">{user ? user.full_name : t('เข้าสู่ระบบ', 'Log in')}</span>
            </Link>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-50 bg-brand-red shadow-[0_2px_12px_rgba(133,0,0,.3)]">
        {/* Desktop tier 2 — centred red menu bar */}
        <div className="container hidden h-[60px] items-center justify-center gap-1 xl:flex">
          <nav className="flex items-center" aria-label={t('เมนูหลัก', 'Main menu')}>
            {NAV.map((n) => n.menu ? <ServicesMenu key={n.href} active={servicesActive} /> : (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}
                className={cn('relative flex h-11 items-center whitespace-nowrap rounded-xl px-4 text-[17px] font-semibold transition hover:bg-white/10', active(n.href) ? 'text-brand-yellow after:absolute after:inset-x-4 after:-bottom-[8px] after:h-1 after:rounded-full after:bg-brand-yellow' : 'text-white')}>
                {lang === 'th' ? n.th : n.en}
              </Link>
            ))}
          </nav>
          <Link href="/booking/" className={buttonClass('accent', 'md', 'ml-4 rounded-full px-6 font-bold shadow-[0_3px_0_#b39500]')}><Ship className="h-5 w-5" />{t('จองเรือขนส่ง', 'Book Cargo')}</Link>
        </div>
        {/* Phones & tablets — compact bar */}
        <div className="container flex h-[68px] items-center gap-2 xl:hidden">
          <Link href="/" aria-label={`${SITE.name_th} — ${t('หน้าแรก', 'Home')}`} className="shrink-0"><Logo light /></Link>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <LangSwitch dark />
            <Link href="/cart/" className="relative grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10" aria-label={t(`ตะกร้าสินค้า ${count} รายการ`, `Cart, ${count} items`)}>
              <ShoppingCart className="h-[22px] w-[22px]" />
              {count > 0 && <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-yellow px-1 text-[13px] font-bold text-brand-ink">{count}</span>}
            </Link>
            <Link href="/booking/" className={buttonClass('accent', 'md', 'hidden rounded-full font-bold md:inline-flex')}><Ship className="h-5 w-5" />{t('จองเรือขนส่ง', 'Book Cargo')}</Link>
            <button className="grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10" onClick={() => setOpen(true)} aria-label={t('เปิดเมนู', 'Open menu')} aria-expanded={open}>
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label={t('เมนู', 'Menu')}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(380px,92vw)] flex-col bg-white shadow-2xl">
            <div className="flex h-[68px] items-center justify-between border-b px-4">
              <Logo compact />
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-neutral-100" aria-label={t('ปิดเมนู', 'Close menu')}><X className="h-6 w-6" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label={t('เมนู', 'Menu')}>
              {NAV.filter((n) => !n.menu).map((n) => (
                <Link key={n.href} href={n.href} className={cn('flex min-h-[52px] items-center justify-between rounded-xl px-4 text-[17px] font-medium', active(n.href) ? 'bg-red-50 text-brand-red' : 'hover:bg-brand-grey')}>
                  {lang === 'th' ? n.th : n.en}<ChevronRight className="h-5 w-5 opacity-40" />
                </Link>
              ))}
              <p className="mt-4 px-4 pb-1 text-sm font-semibold text-neutral-500">{t('บริการของเรา', 'Our services')}</p>
              {SERVICE_LINKS.slice(1).map((s) => (
                <Link key={s.href} href={s.href} className="flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-[17px] font-medium hover:bg-brand-grey">
                  <s.icon className="h-5 w-5 text-brand-red" />{t(s.th, s.en)}
                </Link>
              ))}
              <div className="my-3 border-t" />
              <Link href={user ? '/account/' : '/login/'} className="flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-[17px] font-medium hover:bg-brand-grey">
                {user ? <><LayoutDashboard className="h-5 w-5" />{t('บัญชีของฉัน', 'My account')}</> : <><LogIn className="h-5 w-5" />{t('เข้าสู่ระบบ (ไม่บังคับ)', 'Log in (optional)')}</>}
              </Link>
              {isStaff && <Link href="/admin/" className="flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-[17px] font-medium hover:bg-brand-grey"><ShieldCheck className="h-5 w-5 text-brand-red" />{t('ระบบหลังบ้าน', 'Admin dashboard')}</Link>}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

/** Mobile bottom bar: five destinations, booking raised in the middle. */
export function BottomNav() {
  const { t } = useLang();
  const path = usePathname() || '/';
  if (path.startsWith('/admin')) return null;
  const items = [
    { href: '/', icon: Home, th: 'หน้าแรก', en: 'Home', on: path === '/' },
    { href: '/services/', icon: LayoutGrid, th: 'บริการ', en: 'Services', on: ['/services', '/materials', '/construction', '/machinery', '/schedule', '/cart'].some((p) => path.startsWith(p)) },
    { href: '/booking/', icon: Ship, th: 'จองเรือ', en: 'Book', on: path.startsWith('/booking'), main: true },
    { href: '/track/', icon: PackageSearch, th: 'ติดตาม', en: 'Track', on: path.startsWith('/track') },
    { href: '/contact/', icon: Headphones, th: 'ติดต่อ', en: 'Contact', on: path.startsWith('/contact') },
  ];
  return (
    <>
      <div className="h-[76px] xl:hidden" aria-hidden />
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,.06)] backdrop-blur xl:hidden" aria-label={t('เมนูด้านล่าง', 'Bottom menu')}>
        <ul className="mx-auto grid h-[68px] max-w-lg grid-cols-5">
          {items.map((i) => (
            <li key={i.href} className="flex justify-center">
              {i.main ? (
                <Link href={i.href} aria-current={i.on ? 'page' : undefined} className="-mt-5 flex flex-col items-center gap-1">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-red text-white shadow-lg ring-4 ring-white"><i.icon className="h-7 w-7" /></span>
                  <span className="text-[13px] font-bold text-brand-red">{t(i.th, i.en)}</span>
                </Link>
              ) : (
                <Link href={i.href} aria-current={i.on ? 'page' : undefined} className={cn('flex w-full flex-col items-center justify-center gap-1 text-[13px] font-medium', i.on ? 'text-brand-red' : 'text-neutral-600')}>
                  <i.icon className="h-6 w-6" />{t(i.th, i.en)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function Footer() {
  const { t, lang } = useLang();
  const s = useSettings();
  const address = s ? (lang === 'th' ? s.address_th : s.address_en) : '';
  const missing = t('รอผู้ดูแลระบบเพิ่มข้อมูล', 'To be added by the administrator');
  return (
    <footer className="red-field text-white">
      <div className="h-1.5 bg-brand-yellow" />
      <div className="container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/90">
            {t('ขนส่งสินค้าทางทะเล วัสดุก่อสร้าง รับเหมาก่อสร้าง รถเครน รถดัมพ์ และเครื่องจักรหนัก — ชุมพร เกาะเต่า เกาะพะงัน',
              'Marine cargo, construction materials, contracting, cranes, dump trucks and heavy machinery — Chumphon, Koh Tao, Koh Phangan.')}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-brand-yellow">{t('บริการ', 'Services')}</h3>
          <ul className="mt-4 space-y-3 text-[15px] text-white/90">
            {SERVICE_LINKS.map((l) => <li key={l.href}><Link className="hover:text-white" href={l.href}>{t(l.th, l.en)}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-brand-yellow">{t('ลูกค้า', 'Customers')}</h3>
          <ul className="mt-4 space-y-3 text-[15px] text-white/90">
            <li><Link className="hover:text-white" href="/track/">{t('ติดตามสถานะ', 'Track order')}</Link></li>
            <li><Link className="hover:text-white" href="/quote/">{t('ขอใบเสนอราคา', 'Request a quote')}</Link></li>
            <li><Link className="hover:text-white" href="/account/">{t('บัญชีของฉัน', 'My account')}</Link></li>
            <li><Link className="hover:text-white" href="/about/">{t('เกี่ยวกับเรา', 'About us')}</Link></li>
            <li><Link className="hover:text-white" href="/privacy/">{t('นโยบายความเป็นส่วนตัว', 'Privacy policy')}</Link></li>
            <li><Link className="hover:text-white" href="/terms/">{t('ข้อกำหนดการใช้บริการ', 'Terms of service')}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-brand-yellow">{t('ติดต่อเรา', 'Contact')}</h3>
          <ul className="mt-4 space-y-3 text-[15px] text-white/90">
            <li className="flex gap-2.5"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-yellow" />{s?.phone ? <a href={`tel:${s.phone}`} className="hover:text-white">{s.phone}</a> : <span className="italic text-white/75">{missing}</span>}</li>
            <li className="flex gap-2.5"><MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-yellow" />{s?.line_id ? <span>LINE: {s.line_id}</span> : <span className="italic text-white/75">{missing}</span>}</li>
            <li className="flex gap-2.5"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-yellow" />{s?.email ? <a href={`mailto:${s.email}`} className="hover:text-white">{s.email}</a> : <span className="italic text-white/75">{missing}</span>}</li>
            <li className="flex gap-2.5"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-yellow" />{address || <span className="italic text-white/75">{missing}</span>}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 bg-black/15">
        <div className="container flex flex-col gap-2 py-5 text-[13px] text-white/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name_th} · {SITE.name_en}</p>
          <p>{t('เวลาประเทศไทย (GMT+7) · ราคาเป็นเงินบาท', 'Thailand time (GMT+7) · Prices in Thai Baht')}</p>
        </div>
      </div>
    </footer>
  );
}

/** Desktop only — on phones the bottom bar carries “ติดต่อ”, so nothing floats over forms or buttons. */
export function FloatingContact() {
  const { t } = useLang();
  const s = useSettings();
  const path = usePathname();
  if (path?.startsWith('/admin')) return null;
  const lineHref = s?.line_url || '/contact/#line';
  const telHref = s?.phone ? `tel:${s.phone}` : '/contact/#phone';
  return (
    <div className="no-print fixed bottom-6 right-6 z-40 hidden flex-col gap-3 xl:flex">
      <a href={lineHref} target={s?.line_url ? '_blank' : undefined} rel="noreferrer" aria-label={t('ติดต่อทาง LINE', 'Contact via LINE')}
        className="grid h-14 w-14 place-items-center rounded-full bg-[#06C755] text-white shadow-lg ring-4 ring-white transition hover:scale-105">
        <LineIcon className="h-7 w-7" />
      </a>
      <a href={telHref} aria-label={t('โทรหาเรา', 'Call us')} className="grid h-14 w-14 place-items-center rounded-full bg-brand-red text-white shadow-lg ring-4 ring-white transition hover:scale-105">
        <Phone className="h-6 w-6" />
      </a>
    </div>
  );
}

export function LineIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 3C6.48 3 2 6.58 2 11c0 3.96 3.6 7.27 8.46 7.9.33.07.78.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .88.55 1.08-.46 5.83-3.43 7.95-5.88C21.53 14.24 22 12.68 22 11c0-4.42-4.48-8-10-8Zm-3.6 10.4H6.4a.53.53 0 0 1-.53-.53V8.9a.53.53 0 1 1 1.06 0v3.44H8.4a.53.53 0 1 1 0 1.06Zm1.9-.53a.53.53 0 1 1-1.06 0V8.9a.53.53 0 1 1 1.06 0v3.97Zm4.8 0a.53.53 0 0 1-.96.31l-2.03-2.77v2.46a.53.53 0 1 1-1.06 0V8.9a.53.53 0 0 1 .96-.31l2.03 2.77V8.9a.53.53 0 1 1 1.06 0v3.97Zm3.2-2.51a.53.53 0 1 1 0 1.06h-1.47v.92h1.47a.53.53 0 1 1 0 1.06h-2a.53.53 0 0 1-.53-.53V8.9c0-.29.24-.53.53-.53h2a.53.53 0 1 1 0 1.06h-1.47v.93h1.47Z" /></svg>;
}
