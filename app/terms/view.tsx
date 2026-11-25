'use client';

import { useLang } from '@/lib/i18n';
import { Alert, PageHeader } from '@/components/ui';

export default function View() {
  const { t } = useLang();
  const items = [
    [t('การจองและการยืนยัน', 'Bookings and confirmation'), t('คำขอจองผ่านเว็บไซต์ยังไม่ถือเป็นการจองที่ยืนยันแล้ว จนกว่าเจ้าหน้าที่จะตรวจสอบและยืนยัน', 'An online request is not a confirmed booking until approved by our staff.')],
    [t('ราคาและใบเสนอราคา', 'Prices and quotations'), t('ราคาที่แสดงเป็นราคาประมาณการเมื่อมีการตั้งค่าไว้เท่านั้น ราคาจริงเป็นไปตามใบเสนอราคาที่ออกโดยบริษัท', 'Displayed prices are estimates only where configured; the binding price is the company-issued quotation.')],
    [t('การชำระเงิน', 'Payment'), t('การชำระเงินจะสมบูรณ์เมื่อเจ้าหน้าที่ตรวจสอบหลักฐานการโอนแล้ว [ระบุเงื่อนไขมัดจำ/คืนเงิน]', 'Payment is complete once staff verify your transfer slip. [Specify deposit/refund terms]')],
    [t('สินค้าและความรับผิด', 'Cargo and liability'), t('[ระบุสินค้าต้องห้าม การบรรจุหีบห่อ การประกันภัย และขอบเขตความรับผิด]', '[Specify prohibited goods, packaging, insurance and liability limits]')],
    [t('การยกเลิกและเลื่อน', 'Cancellation and rescheduling'), t('[ระบุเงื่อนไขการยกเลิก/เลื่อนรอบเรือ รวมถึงกรณีสภาพอากาศ]', '[Specify cancellation/rescheduling terms, including weather]')],
  ];
  return (
    <>
      <PageHeader eyebrow={t('เงื่อนไข', 'Terms')} title={t('ข้อกำหนดการใช้บริการ', 'Terms of Service')} />
      <div className="container max-w-3xl space-y-8 py-12">
        <Alert>{t('เอกสารนี้เป็นแม่แบบ ข้อความในวงเล็บเหลี่ยมต้องกรอกโดยบริษัทและตรวจสอบโดยที่ปรึกษากฎหมาย', 'Template only — bracketed text must be completed by the company and reviewed by counsel.')}</Alert>
        {items.map(([h, b], i) => <section key={h}><h2 className="font-display text-xl font-bold">{i + 1}. {h}</h2><p className="mt-2 leading-relaxed text-neutral-700">{b}</p></section>)}
      </div>
    </>
  );
}
