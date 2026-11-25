'use client';

import { Anchor, Building2, Layers, Truck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { PageHeader, LinkButton } from '@/components/ui';
import { CtaBand, WhyUs } from '@/components/home/Sections';

export default function View() {
  const { t } = useLang();
  const pillars = [
    { icon: Anchor, th: 'ขนส่งทางทะเล', en: 'Marine transport', dth: 'เส้นทางชุมพร–เกาะเต่า และชุมพร–เกาะพะงัน ทั้งขาไปและขากลับ', den: 'Chumphon–Koh Tao and Chumphon–Koh Phangan, both directions.' },
    { icon: Layers, th: 'วัสดุก่อสร้าง', en: 'Construction materials', dth: 'หิน ปูน ทราย ท่อ บ่อ อิฐ เหล็ก และวัสดุก่อสร้างทุกชนิด', den: 'Stone, cement, sand, pipes, rings, bricks, steel and more.' },
    { icon: Truck, th: 'รถและเครื่องจักร', en: 'Trucks & machinery', dth: 'รถดัมพ์ รถเครน รถแบคโฮ และการขนย้ายเครื่องจักรหนัก', den: 'Dump trucks, cranes, excavators and heavy machinery transport.' },
    { icon: Building2, th: 'รับเหมาก่อสร้าง', en: 'Contracting', dth: 'งานก่อสร้าง ฐานราก คอนกรีต ปรับพื้นที่ และรีโนเวท', den: 'Building, foundations, concrete, land preparation and renovation.' },
  ];
  return (
    <>
      <PageHeader eyebrow={t('เกี่ยวกับเรา', 'About us')} title={t('บ้านพรทวีสิน — ขนส่ง วัสดุ และก่อสร้าง ในที่เดียว', 'Baan PornTaweesin — transport, materials and construction in one place')}
        lead={t('เราเชื่อมต่อชุมพร เกาะเต่า และเกาะพะงัน ด้วยบริการขนส่งทางทะเล วัสดุก่อสร้าง รถและเครื่องจักร และงานรับเหมาก่อสร้าง', 'We connect Chumphon, Koh Tao and Koh Phangan through sea freight, building materials, machinery and contracting.')} />
      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">{t('สิ่งที่เราทำ', 'What we do')}</p>
            <h2 className="h2 mt-3">{t('ทำให้การก่อสร้างบนเกาะง่ายขึ้น', 'Making island construction simpler')}</h2>
            <p className="lead mt-5">{t('การก่อสร้างบนเกาะต้องอาศัยการวางแผนขนส่งวัสดุและเครื่องจักรข้ามทะเล บ้านพรทวีสินรวมบริการจัดหาวัสดุ เรือขนส่ง รถบรรทุก รถเครน และทีมก่อสร้างไว้ด้วยกัน เพื่อให้ลูกค้าติดต่อเพียงที่เดียว',
              'Building on an island means planning how materials and machinery cross the sea. Baan PornTaweesin brings material supply, cargo vessels, trucks, cranes and construction crews together so customers deal with one team.')}</p>
            <div className="mt-6 rounded-2xl border-l-4 border-brand-yellow bg-brand-grey p-5 text-sm text-neutral-600">
              {t('ข้อมูลประวัติบริษัท ปีที่ก่อตั้ง ใบอนุญาต และผลงาน จะเพิ่มโดยผู้ดูแลระบบเมื่อได้รับข้อมูลที่ยืนยันแล้ว', 'Company history, founding year, licences and references will be added by the administrator once verified.')}
            </div>
            <div className="mt-8 flex flex-wrap gap-3"><LinkButton href="/services/">{t('ดูบริการทั้งหมด', 'See all services')}</LinkButton><LinkButton href="/contact/" variant="outline">{t('ติดต่อเรา', 'Contact us')}</LinkButton></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 rotate-2 rounded-3xl bg-brand-red" aria-hidden />
            <img src="/brand/banner-alt.webp" alt={t('แบนเนอร์บริษัทบ้านพรทวีสิน', 'Baan PornTaweesin company banner')} className="relative w-full rounded-3xl shadow-xl ring-4 ring-white" />
          </div>
        </div>
      </section>
      <section className="section bg-brand-grey pt-0 md:pt-0">
        <div className="container grid gap-5 pt-16 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div key={p.en} className="card p-6">
              <p.icon className="h-8 w-8 text-brand-red" />
              <h3 className="mt-4 font-display text-lg font-bold">{t(p.th, p.en)}</h3>
              <p className="mt-2 text-sm text-neutral-600">{t(p.dth, p.den)}</p>
            </div>
          ))}
        </div>
      </section>
      <WhyUs />
      <CtaBand />
    </>
  );
}
