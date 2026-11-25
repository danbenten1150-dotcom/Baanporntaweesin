'use client';

import { useEffect, useState } from 'react';
import { Construction, Forklift, Send, Truck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { MACHINERY_TYPE } from '@/lib/labels';
import type { MachineryBooking, MachineryType } from '@/lib/types';
import { cn, todayKey } from '@/lib/utils';
import { Button, Checkbox, Field, FilePicker, Input, PageHeader, Segmented, StatusBadge, Textarea } from '@/components/ui';
import { ContactFields, downloadSummary, ErrorBanner, SuccessPanel, TermsCheck, useContactState, useSubmitError } from '@/components/shared/forms';

const ICONS: Record<MachineryType, React.ComponentType<{ className?: string }>> = { dump_truck: Truck, crane: Construction, excavator: Forklift, heavy: Forklift, transport: Truck };

export default function View() {
  const { t, pick } = useLang();
  const [type, setType] = useState<MachineryType>('dump_truck');
  useEffect(() => { // links like /machinery/#crane pre-select the machine type
    const read = () => { const h = location.hash.slice(1) as MachineryType; if (h in MACHINERY_TYPE) setType(h); };
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, []);
  const [f, setF] = useState({ capacity: '', location: '', start_date: '', duration: '1', description: '' });
  const [unit, setUnit] = useState<'hour' | 'day'>('day');
  const [operator, setOperator] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [contact, setContact] = useContactState();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MachineryBooking | null>(null);
  const err = useSubmitError();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    err.reset(); setBusy(true);
    try {
      const files = await api.uploadFiles(photos, 'machinery');
      const r = await api.createMachineryBooking({ machinery_type: type, capacity: f.capacity, location: f.location, start_date: f.start_date, duration: Number(f.duration), rate_unit: unit, operator, description: f.description, files, contact, accept_terms: terms as true });
      setDone(r); window.scrollTo({ top: 0 });
    } catch (e) { err.handle(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow={t('เช่ารถและเครื่องจักร', 'Machinery & vehicle hire')} title={t('จองรถดัมพ์ รถเครน รถแบคโฮ และเครื่องจักรหนัก', 'Book dump trucks, cranes, excavators and heavy machinery')} lead={t('ส่งคำขอและรับใบเสนอราคา เจ้าหน้าที่จะยืนยันความพร้อมของเครื่องจักรก่อนการจอง', 'Request a quote — staff confirm machine availability before the booking is final.')} />
      <div className="container max-w-4xl py-10">
        {done ? (
          <SuccessPanel title={t('ส่งคำขอเช่าเครื่องจักรแล้ว', 'Machinery request submitted')} refNo={done.ref}
            onDownload={() => downloadSummary({ title: t('คำขอเช่าเครื่องจักร', 'Machinery rental request'), ref: done.ref, demo: IS_DEMO, note: t('รอเจ้าหน้าที่ยืนยันความพร้อมและราคา', 'Awaiting staff confirmation of availability and price.'),
              rows: [{ label: t('ประเภท', 'Type'), value: pick(MACHINERY_TYPE[done.machinery_type]) }, { label: t('สถานที่', 'Location'), value: done.location }, { label: t('เริ่ม', 'Start'), value: done.start_date }, { label: t('ระยะเวลา', 'Duration'), value: `${done.duration} ${done.rate_unit === 'day' ? t('วัน', 'day(s)') : t('ชั่วโมง', 'hour(s)')}` }, { label: t('พนักงานขับ', 'Operator'), value: done.operator ? t('ต้องการ', 'Required') : t('ไม่ต้องการ', 'Not required') }] })}>
            <div className="flex items-center gap-2"><span className="text-sm text-neutral-500">{t('สถานะ', 'Status')}:</span><StatusBadge status="pending_review" /></div>
          </SuccessPanel>
        ) : (
          <form className="card space-y-8 p-5 md:p-8" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <section>
              <h2 className="font-display text-xl font-bold">{t('ประเภทรถ/เครื่องจักร', 'Machinery type')}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(Object.keys(MACHINERY_TYPE) as MachineryType[]).map((k) => { const I = ICONS[k]; return (
                  <button type="button" key={k} onClick={() => setType(k)} aria-pressed={type === k}
                    className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center text-sm font-semibold transition', type === k ? 'border-brand-red bg-red-50/50 text-brand-red' : 'border-neutral-200 hover:border-neutral-300')}>
                    <I className="h-7 w-7" />{pick(MACHINERY_TYPE[k])}
                  </button>
                ); })}
              </div>
            </section>
            <section className="grid gap-4 sm:grid-cols-2">
              <Field label={t('ขนาด/ความสามารถที่ต้องการ', 'Required capacity')} hint={t('เช่น ยกได้ 10 ตัน, ดัมพ์ 6 ล้อ', 'e.g. 10-tonne lift, 6-wheel dump')}><Input value={f.capacity} onChange={set('capacity')} /></Field>
              <Field label={t('สถานที่ปฏิบัติงาน', 'Project location')} required error={err.fields.location}><Input value={f.location} onChange={set('location')} invalid={!!err.fields.location} /></Field>
              <Field label={t('วันที่เริ่มเช่า', 'Rental start date')} required error={err.fields.start_date}><Input type="date" min={todayKey()} value={f.start_date} onChange={set('start_date')} invalid={!!err.fields.start_date} /></Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium">{t('ระยะเวลาเช่า', 'Rental duration')} <span className="text-brand-red">*</span></span>
                <div className="flex gap-2"><Input type="number" min={1} className="w-24" value={f.duration} onChange={set('duration')} invalid={!!err.fields.duration} aria-label={t('ระยะเวลาเช่า', 'Rental duration')} />
                  <Segmented value={unit} onChange={setUnit} options={[{ value: 'hour', label: t('รายชั่วโมง', 'Hourly') }, { value: 'day', label: t('รายวัน', 'Daily') }]} /></div>
              </div>
              <Checkbox checked={operator} onChange={setOperator} className="sm:col-span-2">{t('ต้องการพนักงานขับ/ควบคุมเครื่องจักร', 'Operator required')}</Checkbox>
              <Field label={t('รายละเอียดงาน', 'Job description')} required error={err.fields.description} className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} invalid={!!err.fields.description} /></Field>
              <div className="sm:col-span-2"><FilePicker label={t('รูปภาพประกอบ', 'Supporting photos')} files={photos} onChange={setPhotos} accept="image/jpeg,image/png,image/webp" /></div>
            </section>
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">{t('ข้อมูลผู้ติดต่อ', 'Contact information')}</h2>
              <ContactFields value={contact} onChange={setContact} errors={err.fields} />
            </section>
            <TermsCheck checked={terms} onChange={setTerms} error={err.fields.accept_terms} />
            <ErrorBanner message={err.message} />
            <Button type="submit" size="lg" variant="accent" loading={busy} className="w-full sm:w-auto"><Send className="h-4 w-4" />{t('ขอใบเสนอราคา', 'Request quotation')}</Button>
          </form>
        )}
      </div>
    </>
  );
}
