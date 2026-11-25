'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, CalendarClock, ClipboardList, ExternalLink, Forklift, Gauge, HardHat, Layers, Lock, LogOut, Settings, Users, Wallet } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { api, useQuery } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Alert, LinkButton, Spinner, Tabs, useToast } from '@/components/ui';
import { Logo } from '@/components/layout/SiteChrome';
import { Schedules, Vessels } from '@/components/admin/ops';
import { Bookings } from '@/components/admin/bookings';
import { NotificationCenter, Overview, Reports } from '@/components/admin/overview';
import { MediaAdmin } from '@/components/admin/media';
import { ConstructionAdmin, CustomersAdmin, FinanceAdmin, MachineryAdmin, OrdersAdmin, ProductsAdmin, WebsiteAdmin } from '@/components/admin/biz';

const MODULES = [
  { id: 'overview', icon: Gauge, th: 'ภาพรวม', en: 'Overview' },
  { id: 'bookings', icon: ClipboardList, th: 'รายการจองเรือ', en: 'Ship bookings' },
  { id: 'schedules', icon: CalendarClock, th: 'ตารางเดินเรือ', en: 'Schedules' },
  { id: 'construction', icon: HardHat, th: 'งานก่อสร้าง', en: 'Construction' },
  { id: 'materials', icon: Layers, th: 'วัสดุก่อสร้าง', en: 'Materials' },
  { id: 'machinery', icon: Forklift, th: 'รถและเครื่องจักร', en: 'Machinery' },
  { id: 'customers', icon: Users, th: 'ลูกค้า', en: 'Customers' },
  { id: 'finance', icon: Wallet, th: 'การเงิน', en: 'Finance' },
  { id: 'reports', icon: BarChart3, th: 'รายงาน', en: 'Reports' },
  { id: 'settings', icon: Settings, th: 'ตั้งค่า', en: 'Settings' },
] as const;
type ModuleId = (typeof MODULES)[number]['id'];
// old links (notifications, bookmarks) keep working
const ALIAS: Record<string, ModuleId> = { vessels: 'schedules', orders: 'materials', products: 'materials', media: 'settings', website: 'settings' };

export default function View() {
  const { t } = useLang();
  const { user, isStaff, loading, signOut } = useAuth();
  const toast = useToast();
  const [mod, setMod] = useState<ModuleId>('overview');
  const [sub, setSub] = useState('');
  const [bell, setBell] = useState(false);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const { data: s, reload } = useQuery(() => (isStaff ? api.getStore() : Promise.resolve(null)), [isStaff]);

  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      if (MODULES.some((m) => m.id === h)) { setMod(h as ModuleId); setSub(''); }
      else if (ALIAS[h]) { setMod(ALIAS[h]); setSub(h); }
    };
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, []);
  // live updates: realtime / other tabs trigger reloads; a slow poll is the safety net
  useEffect(() => { if (!isStaff) return; const id = setInterval(() => reload(true), 20000); return () => clearInterval(id); }, [isStaff, reload]);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!s) return;
    const n = s.cargo.length + s.construction.length + s.machineryBookings.length + s.orders.length;
    if (seen.current != null && n > seen.current) toast(t('มีคำขอใหม่เข้ามา', 'A new request just arrived'), 'info');
    seen.current = n;
  }, [s, toast, t]);

  const go = (m: string) => {
    const target = (MODULES.some((x) => x.id === m) ? m : ALIAS[m]) as ModuleId | undefined;
    if (!target) return;
    setMod(target); setSub(ALIAS[m] ? m : ''); setOpenRef(null);
    history.replaceState(null, '', `#${target}`); window.scrollTo({ top: 0 });
  };

  if (loading) return <Spinner />;
  if (!isStaff) return (
    <div className="container max-w-lg py-20 text-center">
      <Lock className="mx-auto h-12 w-12 text-brand-red" />
      <h1 className="mt-4 font-display text-2xl font-bold">{t('สำหรับเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น', 'Authorised staff only')}</h1>
      <p className="mt-2 text-neutral-600">{user ? t('บัญชีของคุณไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน', 'Your account does not have admin access.') : t('กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่', 'Please log in with a staff account.')}</p>
      <LinkButton href="/login/" className="mt-6">{t('เข้าสู่ระบบ', 'Log in')}</LinkButton>
    </div>
  );
  if (!s) return <Spinner />;

  const unread = s.notifications.filter((n) => n.audience === 'admin' && !n.read).length;
  const badge: Partial<Record<ModuleId, number>> = {
    bookings: s.cargo.filter((b) => b.status === 'pending_review').length,
    construction: s.construction.filter((c) => c.status === 'submitted').length,
    materials: s.orders.filter((o) => o.status === 'quotation_requested').length,
    machinery: s.machineryBookings.filter((m) => m.status === 'pending_review').length,
    finance: s.payments.filter((p) => p.status === 'pending').length,
  };
  const current = MODULES.find((m) => m.id === mod)!;

  return (
    <div className="min-h-screen bg-brand-grey">
      <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-white lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] xl:top-[60px] xl:h-[calc(100vh-60px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="hidden border-b p-5 lg:block"><Logo compact /><p className="mt-3 font-bold">{t('ระบบหลังบ้าน', 'Admin dashboard')}</p><p className="truncate text-[14px] text-neutral-500">{user?.full_name}</p></div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto p-2 lg:flex-col lg:p-3" aria-label={t('เมนูหลังบ้าน', 'Admin menu')}>
            {MODULES.map((m) => (
              <button key={m.id} onClick={() => go(m.id)} aria-current={mod === m.id ? 'page' : undefined}
                className={cn('flex h-12 shrink-0 items-center gap-3 rounded-xl px-3.5 text-base font-medium transition', mod === m.id ? 'bg-brand-red text-white' : 'text-neutral-700 hover:bg-brand-grey')}>
                <m.icon className="h-5 w-5" />{t(m.th, m.en)}
                {!!badge[m.id] && <span className={cn('ml-auto rounded-full px-2 text-[13px] font-bold', mod === m.id ? 'bg-brand-yellow text-brand-ink' : 'bg-brand-red text-white')}>{badge[m.id]}</span>}
              </button>
            ))}
            <div className="hidden border-t pt-2 lg:mt-3 lg:block">
              <Link href="/" className="flex h-12 items-center gap-3 rounded-xl px-3.5 text-neutral-600 hover:bg-brand-grey"><ExternalLink className="h-5 w-5" />{t('ดูหน้าเว็บไซต์', 'View website')}</Link>
              <button onClick={() => signOut()} className="flex h-12 w-full items-center gap-3 rounded-xl px-3.5 text-neutral-600 hover:bg-brand-grey"><LogOut className="h-5 w-5" />{t('ออกจากระบบ', 'Log out')}</button>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 p-4 md:p-6 lg:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2.5 font-display text-[26px] font-bold"><current.icon className="h-7 w-7 text-brand-red" />{t(current.th, current.en)}</h1>
            <button onClick={() => setBell(true)} className="relative flex h-12 items-center gap-2 rounded-xl bg-white px-4 font-medium shadow-sm ring-1 ring-neutral-200" aria-label={t(`การแจ้งเตือน ${unread} รายการใหม่`, `Notifications, ${unread} new`)}>
              <Bell className="h-5 w-5" /><span className="hidden sm:inline">{t('การแจ้งเตือน', 'Notifications')}</span>
              {unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-red px-1.5 text-[13px] font-bold text-white">{unread}</span>}
            </button>
          </div>
          {IS_DEMO && <Alert className="mb-5">{t('โหมดสาธิต: ข้อมูลทั้งหมดเป็นตัวอย่าง และสิทธิ์ผู้ดูแลจำลองในเบราว์เซอร์ เมื่อเชื่อม Supabase สิทธิ์จะถูกบังคับที่ฐานข้อมูล และรายการใหม่จะขึ้นทันทีแบบเรียลไทม์', 'Demo mode: sample data and simulated admin access. With Supabase, access is enforced in the database and new requests appear in real time.')}</Alert>}

          {mod === 'overview' && <Overview s={s} go={go} openBooking={(ref) => { setOpenRef(ref); setMod('bookings'); history.replaceState(null, '', '#bookings'); }} />}
          {mod === 'bookings' && <Bookings key={openRef || 'list'} s={s} openRef={openRef} />}
          {mod === 'schedules' && <SubTabs value={sub || 'schedules'} onChange={setSub} items={[['schedules', t('รอบเดินเรือและเส้นทาง', 'Sailings & routes')], ['vessels', t('เรือ', 'Vessels')]]}>
            {(v) => v === 'vessels' ? <Vessels s={s} /> : <Schedules s={s} />}</SubTabs>}
          {mod === 'construction' && <ConstructionAdmin s={s} />}
          {mod === 'materials' && <SubTabs value={sub === 'products' ? 'products' : 'orders'} onChange={setSub} items={[['orders', t('คำสั่งซื้อ / ขอราคา', 'Orders & quotes')], ['products', t('สินค้าและสต็อก', 'Products & stock')]]}>
            {(v) => v === 'products' ? <ProductsAdmin s={s} /> : <OrdersAdmin s={s} />}</SubTabs>}
          {mod === 'machinery' && <MachineryAdmin s={s} />}
          {mod === 'customers' && <CustomersAdmin s={s} />}
          {mod === 'finance' && <FinanceAdmin s={s} />}
          {mod === 'reports' && <Reports s={s} />}
          {mod === 'settings' && <SubTabs value={sub === 'media' ? 'media' : 'website'} onChange={setSub} items={[['website', t('ข้อมูลเว็บไซต์และบริการ', 'Website & services')], ['media', t('รูปภาพเว็บไซต์', 'Website photos')]]}>
            {(v) => v === 'media' ? <MediaAdmin s={s} /> : <WebsiteAdmin s={s} />}</SubTabs>}
        </main>
      </div>
      <NotificationCenter s={s} open={bell} onClose={() => setBell(false)} go={go} />
    </div>
  );
}

function SubTabs({ value, onChange, items, children }: { value: string; onChange: (v: string) => void; items: [string, string][]; children: (v: string) => React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Tabs value={value} onChange={onChange} items={items.map(([v, l]) => ({ value: v, label: l }))} />
      {children(value)}
    </div>
  );
}
