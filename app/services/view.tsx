'use client';

import { CheckCircle2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { LinkButton, PageHeader, PhotoSlot } from '@/components/ui';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CtaBand, SERVICES, useServiceImage } from '@/components/home/Sections';
import { SERVICE_LINKS } from '@/components/layout/SiteChrome';

const DETAILS: Record<string, { th: string[]; en: string[] }> = {
  marine: { th: ['สินค้าทั่วไปและวัสดุก่อสร้าง', 'รถยนต์ รถจักรยานยนต์ รถบรรทุก', 'เครื่องจักรหนัก', 'ท่าเรือ–ท่าเรือ หรือรับ-ส่งถึงที่ (ตามที่บริษัทเปิดให้บริการ)'], en: ['General cargo and building materials', 'Cars, motorcycles and trucks', 'Heavy machinery', 'Port-to-port or door service (where offered)'] },
  contractor: { th: ['ที่พักอาศัยและอาคารพาณิชย์', 'งานฐานราก งานคอนกรีต', 'ปรับพื้นที่ ขุด รื้อถอน', 'ปรับปรุง/รีโนเวทอาคาร'], en: ['Residential and commercial', 'Foundations and concrete', 'Land prep, excavation, demolition', 'Renovation'] },
  materials: { th: ['ทราย หิน กรวด', 'ปูนซีเมนต์', 'ท่อคอนกรีต บ่อคอนกรีต', 'อิฐ บล็อก เหล็ก'], en: ['Sand, stone, gravel', 'Cement', 'Concrete pipes and rings', 'Bricks, blocks, steel'] },
  truck: { th: ['รถดัมพ์ขนวัสดุ', 'รถบรรทุกทั่วไป', 'ขนส่งบนฝั่งและบนเกาะ', 'ส่งต่อพร้อมเรือขนส่ง'], en: ['Dump trucks', 'General lorries', 'Mainland and island runs', 'Combined with sea freight'] },
  crane: { th: ['ยกท่อ บ่อ และวัสดุหนัก', 'ขนย้ายเครื่องจักร', 'พร้อมพนักงานควบคุม', 'เช่ารายชั่วโมง/รายวัน'], en: ['Lifting pipes, rings, heavy loads', 'Moving machinery', 'With operator', 'Hourly or daily'] },
  machinery: { th: ['รถแบคโฮ / รถขุด', 'เครื่องจักรงานดิน', 'ขนย้ายเครื่องจักรข้ามเกาะ', 'พร้อมหรือไม่พร้อมคนขับ'], en: ['Excavators', 'Earth-moving equipment', 'Inter-island machinery transport', 'With or without operator'] },
};

export default function View() {
  const { t, lang } = useLang();
  const img = useServiceImage();
  return (
    <>
      <PageHeader eyebrow={t('บริการของเรา', 'Our services')} title={t('เลือกบริการที่ต้องการ', 'Choose a service')} lead={t('แตะเพื่อจองหรือขอใบเสนอราคา ราคาจริงยืนยันโดยเจ้าหน้าที่', 'Tap to book or request a quote. Final prices are confirmed by our team.')} />
      <div className="container py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-[84px] items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-brand-red hover:shadow-card">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-50 text-brand-red"><l.icon className="h-7 w-7" /></span>
              <span className="flex-1"><span className="block text-lg font-bold">{t(l.th, l.en)}</span><span className="block text-[15px] text-neutral-600">{t(l.dth, l.den)}</span></span>
              <ChevronRight className="h-5 w-5 text-neutral-500" />
            </Link>
          ))}
        </div>
        <h2 className="mt-12 font-display text-[28px] font-bold">{t('รายละเอียดบริการ', 'Service details')}</h2>
      </div>
      <div className="container divide-y">
        {SERVICES.map((s, i) => (
          <section key={s.id} id={s.id} className="grid scroll-mt-24 gap-8 py-14 md:grid-cols-2 md:items-center">
            <div className={i % 2 ? 'md:order-2' : ''}>
              <div className="aspect-[16/10] overflow-hidden rounded-3xl shadow-card"><PhotoSlot src={img(s)} alt={lang === 'th' ? s.th : s.en} label={lang === 'th' ? s.th : s.en} icon={s.icon} /></div>
            </div>
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-red text-white"><s.icon className="h-6 w-6" /></span>
              <h2 className="h2 mt-4">{lang === 'th' ? s.th : s.en}</h2>
              <p className="lead mt-3">{lang === 'th' ? s.dth : s.den}</p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {DETAILS[s.id][lang].map((d) => <li key={d} className="flex gap-2 text-[15px]"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" />{d}</li>)}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <LinkButton href={s.action}>{lang === 'th' ? s.ath : s.aen}</LinkButton>
                <LinkButton href="/quote/" variant="outline">{t('ขอใบเสนอราคา', 'Request a quote')}</LinkButton>
              </div>
            </div>
          </section>
        ))}
      </div>
      <CtaBand />
    </>
  );
}
