'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import { Button, Field, PageHeader, Select, Textarea } from '@/components/ui';
import { ContactFields, ErrorBanner, SuccessPanel, SupportBox, useContactState, useSubmitError } from '@/components/shared/forms';

export function QuoteForm({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const [contact, setContact] = useContactState();
  const [service, setService] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const err = useSubmitError();
  const opts = [
    ['marine', t('ขนส่งสินค้าทางทะเล', 'Marine cargo')], ['materials', t('วัสดุก่อสร้าง (สั่งจำนวนมาก)', 'Bulk construction materials')],
    ['construction', t('งานรับเหมาก่อสร้าง', 'Construction work')], ['machinery', t('เช่ารถ/เครื่องจักร', 'Truck / machinery hire')], ['other', t('อื่น ๆ', 'Other')],
  ];
  if (done) return <SuccessPanel title={t('ส่งคำขอใบเสนอราคาแล้ว', 'Quotation request sent')} refNo={done}><p className="text-neutral-600">{t('เจ้าหน้าที่จะติดต่อกลับตามช่องทางที่ให้ไว้', 'Our team will contact you using the details provided.')}</p></SuccessPanel>;
  return (
    <form className="card space-y-5 p-5 md:p-8" noValidate onSubmit={async (e) => {
      e.preventDefault(); err.reset(); setBusy(true);
      try { const r = await api.createQuoteRequest({ service, message, contact }); setDone(r.ref); } catch (x) { err.handle(x); } finally { setBusy(false); }
    }}>
      {!compact && <h2 className="font-display text-xl font-bold">{t('รายละเอียดที่ต้องการ', 'What do you need?')}</h2>}
      <Field label={t('บริการ', 'Service')} required error={err.fields.service}>
        <Select value={service} onChange={(e) => setService(e.target.value)} invalid={!!err.fields.service}>
          <option value="">{t('เลือกบริการ', 'Select a service')}</option>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Field label={t('รายละเอียด', 'Details')} required error={err.fields.message} hint={t('เช่น ชนิดสินค้า ปริมาณ เส้นทาง สถานที่ วันที่ต้องการ', 'e.g. goods, quantity, route, location, preferred date')}>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} invalid={!!err.fields.message} />
      </Field>
      <ContactFields value={contact} onChange={setContact} errors={err.fields} />
      <ErrorBanner message={err.message} />
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto"><Send className="h-4 w-4" />{t('ส่งคำขอใบเสนอราคา', 'Send quotation request')}</Button>
    </form>
  );
}

export default function View() {
  const { t } = useLang();
  return (
    <>
      <PageHeader eyebrow={t('ขอใบเสนอราคา', 'Request a quotation')} title={t('บอกเราว่าต้องการอะไร แล้วเราจะเสนอราคาให้', 'Tell us what you need — we’ll quote it')} lead={t('ราคาจริงจัดทำโดยเจ้าหน้าที่ ระบบจะไม่คำนวณราคาโดยอัตโนมัติหากยังไม่มีราคาที่ยืนยันแล้ว', 'Prices are prepared by our staff; nothing is auto-priced without verified rates.')} />
      <div className="container grid gap-8 py-12 lg:grid-cols-[1.6fr_1fr]">
        <QuoteForm />
        <aside className="space-y-4"><SupportBox /></aside>
      </div>
    </>
  );
}
