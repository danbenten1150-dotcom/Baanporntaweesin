'use client';

import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import { useSettings } from '@/components/layout/SiteChrome';
import { QuoteForm } from '../quote/view';

export default function View() {
  const { t, lang } = useLang();
  const s = useSettings();
  const missing = t('ยังไม่ได้ระบุ — ผู้ดูแลระบบเพิ่มได้ที่ หลังบ้าน › ตั้งค่าเว็บไซต์', 'Not set yet — admin can add it in Dashboard › Website settings');
  const rows = [
    { id: 'phone', icon: Phone, label: t('โทรศัพท์', 'Phone'), value: s?.phone, href: s?.phone ? `tel:${s.phone}` : undefined },
    { id: 'line', icon: MessageCircle, label: 'LINE', value: s?.line_id, href: s?.line_url || undefined },
    { id: 'email', icon: Mail, label: t('อีเมล', 'Email'), value: s?.email, href: s?.email ? `mailto:${s.email}` : undefined },
    { id: 'address', icon: MapPin, label: t('ที่อยู่', 'Address'), value: lang === 'th' ? s?.address_th : s?.address_en },
  ];
  return (
    <>
      <PageHeader eyebrow={t('ติดต่อเรา', 'Contact us')} title={t('พูดคุยกับทีมบ้านพรทวีสิน', 'Talk to the Baan PornTaweesin team')} lead={t('สอบถามการขนส่ง วัสดุก่อสร้าง งานก่อสร้าง หรือเช่าเครื่องจักร', 'Questions on shipping, materials, construction or machinery hire.')} />
      <div className="container grid gap-8 py-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} id={r.id} className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-brand-red"><r.icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">{r.label}</p>
                {r.value ? (r.href ? <a href={r.href} className="font-semibold text-brand-ink hover:text-brand-red">{r.value}</a> : <p className="font-semibold">{r.value}</p>) : <p className="text-sm italic text-neutral-500">{missing}</p>}
                {r.value && r.href?.startsWith('tel:') && <p className="mt-0.5 text-xs text-neutral-500">{r.value}</p>}
              </div>
            </div>
          ))}
          <div className="card flex gap-4 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-brand-red"><Clock className="h-5 w-5" /></span>
            <div><p className="text-sm text-neutral-500">{t('เวลา', 'Time zone')}</p><p className="font-semibold">{t('เวลาประเทศไทย (GMT+7)', 'Thailand time (GMT+7)')}</p></div></div>
        </div>
        <div>
          <h2 className="mb-4 font-display text-2xl font-bold">{t('ส่งข้อความถึงเรา', 'Send us a message')}</h2>
          <QuoteForm compact />
        </div>
      </div>
    </>
  );
}
