'use client';

import { useState } from 'react';
import { Building2, Check, Hammer, HardHat, HelpCircle, Home, Layers, Mountain, Send, Shovel, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { CONSTRUCTION_SERVICE } from '@/lib/labels';
import type { ConstructionRequest, ConstructionService } from '@/lib/types';
import { cn, todayKey } from '@/lib/utils';
import { Alert, Button, DemoTag, Field, FilePicker, Input, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { downloadSummary, ErrorBanner, SupportBox, TermsCheck, useContactState, useSubmitError } from '@/components/shared/forms';

// Everyday words instead of trade terms
const KINDS: { k: ConstructionService; icon: React.ComponentType<{ className?: string }>; th: string; en: string }[] = [
  { k: 'residential', icon: Home, th: 'สร้างบ้าน', en: 'Build a house' },
  { k: 'commercial', icon: Building2, th: 'สร้างอาคาร / ร้านค้า', en: 'Shop or building' },
  { k: 'renovation', icon: Hammer, th: 'ซ่อม ต่อเติม รีโนเวท', en: 'Repair / extend' },
  { k: 'land_preparation', icon: Mountain, th: 'ถมดิน ปรับพื้นที่', en: 'Land filling / levelling' },
  { k: 'excavation', icon: Shovel, th: 'ขุดดิน', en: 'Digging' },
  { k: 'foundation', icon: Layers, th: 'ลงเสาเข็ม / ฐานราก', en: 'Foundations / piles' },
  { k: 'concrete', icon: HardHat, th: 'เทคอนกรีต ลานปูน', en: 'Concrete / slabs' },
  { k: 'demolition', icon: Trash2, th: 'รื้อถอน', en: 'Demolition' },
  { k: 'general', icon: HelpCircle, th: 'อื่น ๆ / ไม่แน่ใจ', en: 'Other / not sure' },
];

export default function View() {
  const { t, pick } = useLang();
  const { data: settings } = useQuery(() => api.getSettings(), []);
  const [f, setF] = useState({ project_type: '' as ConstructionService | '', location: '', description: '', budget: '', start_date: '', project_size: '', land_size: '', end_date: '', inspection_date: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useContactState();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ConstructionRequest | null>(null);
  const err = useSubmitError();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const kinds = KINDS.filter((x) => settings?.construction_services[x.k] !== false);

  const submit = async () => {
    err.reset();
    const fe: Record<string, string> = {};
    if (!f.project_type) fe.project_type = 'required';
    if (f.location.trim().length < 3) fe.location = 'required';
    if (f.description.trim().length < 10) fe.description = 'min10';
    if (contact.full_name.trim().length < 2) fe['contact.full_name'] = 'required';
    if (!/^(\+?66|0)\d{8,9}$/.test(contact.phone.replace(/[\s-]/g, ''))) fe['contact.phone'] = 'phone';
    if (!terms) fe.accept_terms = 'terms';
    if (Object.keys(fe).length) {
      err.setFields(fe);
      setTimeout(() => document.querySelector('[aria-invalid="true"], [data-err="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
      return;
    }
    setBusy(true);
    try {
      const paths = await api.uploadFiles(files, 'construction');
      const r = await api.createConstructionRequest({ ...f, project_type: f.project_type as ConstructionService, files: paths, contact, accept_terms: true });
      setDone(r); window.scrollTo({ top: 0 });
    } catch (e) { err.handle(e); } finally { setBusy(false); }
  };

  if (done) return (
    <div className="container max-w-2xl py-10">
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-card">
        <div className="bg-emerald-600 px-6 py-8 text-center text-white">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20"><Check className="h-9 w-9" /></span>
          <h1 className="mt-4 font-display text-[24px] font-bold">{t('ได้รับคำขอประเมินราคาแล้ว', 'Quotation request received')}</h1>
          <p className="mt-2 text-[17px] text-white/90">{t('เจ้าหน้าที่จะโทรกลับเพื่อนัดดูหน้างานและแจ้งราคา', 'Our team will call to arrange a site visit and give you a price')}</p>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-2xl bg-brand-grey p-5 text-center">
            <p className="text-neutral-600">{t('เลขอ้างอิง', 'Reference')}</p>
            <p className="mt-1 select-all font-mono text-[26px] font-bold tracking-wider">{done.ref}</p>
            <div className="mt-2 flex justify-center gap-2"><StatusBadge status="submitted" />{IS_DEMO && <DemoTag />}</div>
          </div>
          <p className="text-[17px] text-neutral-700">{t('ติดตามสถานะได้ที่เมนู “ติดตาม” ด้วยเลขอ้างอิงนี้และเบอร์', 'Track it under “Track” with this reference and phone')} <strong>{done.contact.phone}</strong></p>
          <Button variant="outline" size="lg" className="w-full" onClick={() => downloadSummary({ title: t('คำขอประเมินราคางานก่อสร้าง', 'Construction quotation request'), ref: done.ref, demo: IS_DEMO, note: t('ราคาจะแจ้งโดยเจ้าหน้าที่หลังดูหน้างาน', 'Price is given by staff after a site visit'),
            rows: [{ label: t('งาน', 'Work'), value: pick(CONSTRUCTION_SERVICE[done.project_type]) }, { label: t('สถานที่', 'Location'), value: done.location }, { label: t('รายละเอียด', 'Details'), value: done.description }, { label: t('ผู้ติดต่อ', 'Contact'), value: `${done.contact.full_name} · ${done.contact.phone}` }] })}>{t('บันทึกสรุปคำขอ', 'Save summary')}</Button>
          <SupportBox />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader eyebrow={t('รับเหมาก่อสร้าง', 'Construction')} title={t('ขอประเมินราคางานก่อสร้าง', 'Get a construction quote')} lead={t('บอกเราสั้น ๆ ว่าอยากทำอะไร เจ้าหน้าที่จะโทรกลับ นัดดูหน้างาน และแจ้งราคา — ไม่มีค่าใช้จ่ายในการขอราคา', 'Tell us briefly what you need. We will call, visit the site and give you a price.')} />
      <form className="container max-w-3xl space-y-6 py-8" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset className="rounded-3xl border border-neutral-200 bg-white p-4 md:p-6" data-err={!!err.fields.project_type}>
          <legend className="sr-only">{t('ประเภทงาน', 'Type of work')}</legend>
          <p className="mb-3 text-lg font-semibold">{t('1. อยากทำงานอะไร', '1. What work do you need?')} <span className="text-brand-red">*</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {kinds.map(({ k, icon: I, th, en }) => (
              <button key={k} type="button" aria-pressed={f.project_type === k} onClick={() => setF({ ...f, project_type: k })}
                className={cn('flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-2 text-center text-[15px] font-semibold', f.project_type === k ? 'border-brand-red bg-red-50 text-brand-red' : 'border-neutral-200 hover:border-neutral-400')}>
                <I className="h-7 w-7" />{t(th, en)}
              </button>
            ))}
          </div>
          {err.fields.project_type && <p className="mt-2 text-[15px] text-red-600">{t('กรุณาเลือกประเภทงาน', 'Please choose the type of work')}</p>}
        </fieldset>

        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
          <p className="text-lg font-semibold">{t('2. รายละเอียดงาน', '2. About the job')}</p>
          <Field label={t('สถานที่ก่อสร้าง', 'Where is the site?')} required error={err.fields.location}><Input value={f.location} onChange={set('location')} invalid={!!err.fields.location} placeholder={t('เช่น เกาะเต่า หาดทรายรี ใกล้ร้าน…', 'e.g. Koh Tao, Sairee, near…')} /></Field>
          <Field label={t('อยากให้ทำอะไรบ้าง', 'What would you like done?')} required error={err.fields.description} hint={t('เล่าแบบที่เข้าใจง่ายได้เลย ไม่ต้องใช้ศัพท์ช่าง', 'Plain words are fine — no technical terms needed')}>
            <Textarea value={f.description} onChange={set('description')} invalid={!!err.fields.description} placeholder={t('เช่น อยากสร้างบ้านชั้นเดียว 2 ห้องนอน บนที่ดินที่ถมแล้ว', 'e.g. a one-storey, 2-bedroom house on filled land')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('งบประมาณโดยประมาณ (ไม่บังคับ)', 'Rough budget (optional)')}><Input inputMode="numeric" value={f.budget} onChange={set('budget')} placeholder={t('เช่น 1,500,000 บาท', 'e.g. 1,500,000 THB')} /></Field>
            <Field label={t('อยากเริ่มงานเมื่อไร', 'When should work start?')}><Input type="date" min={todayKey()} value={f.start_date} onChange={set('start_date')} /></Field>
          </div>
          <FilePicker label={t('รูปหน้างาน หรือแบบบ้าน (ไม่บังคับ)', 'Site photos or drawings (optional)')} files={files} onChange={setFiles} accept="image/*,application/pdf"
            hint={t('ถ่ายจากกล้องมือถือ หรือเลือกรูป/ไฟล์ PDF ได้', 'Take a photo or choose images / PDF')} />
          <details>
            <summary className="cursor-pointer py-2 text-base font-semibold text-brand-red">{t('ข้อมูลเพิ่มเติม (ไม่บังคับ)', 'More details (optional)')}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label={t('ขนาดงานโดยประมาณ', 'Approximate size')}><Input value={f.project_size} onChange={set('project_size')} placeholder={t('เช่น 150 ตร.ม.', 'e.g. 150 m²')} /></Field>
              <Field label={t('ขนาดที่ดิน', 'Land size')}><Input value={f.land_size} onChange={set('land_size')} placeholder={t('เช่น 1 ไร่', 'e.g. 1 rai')} /></Field>
              <Field label={t('อยากให้เสร็จภายใน', 'Finish by')}><Input type="date" min={f.start_date || todayKey()} value={f.end_date} onChange={set('end_date')} /></Field>
              <Field label={t('วันที่สะดวกให้ดูหน้างาน', 'Preferred site-visit date')}><Input type="date" min={todayKey()} value={f.inspection_date} onChange={set('inspection_date')} /></Field>
            </div>
          </details>
        </div>

        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4 md:p-6">
          <p className="text-lg font-semibold">{t('3. ติดต่อคุณทางไหน', '3. How can we reach you?')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('ชื่อ', 'Name')} required error={err.fields['contact.full_name']}><Input autoComplete="name" value={contact.full_name} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} invalid={!!err.fields['contact.full_name']} /></Field>
            <Field label={t('เบอร์โทรศัพท์', 'Phone')} required error={err.fields['contact.phone']}><Input type="tel" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} invalid={!!err.fields['contact.phone']} placeholder="081 234 5678" /></Field>
            <Field label={t('LINE ID (ไม่บังคับ)', 'LINE ID (optional)')}><Input value={contact.line_id} onChange={(e) => setContact({ ...contact, line_id: e.target.value })} /></Field>
            <Field label={t('ชื่อบริษัท (ไม่บังคับ)', 'Company (optional)')}><Input value={contact.company_name} onChange={(e) => setContact({ ...contact, company_name: e.target.value })} /></Field>
          </div>
        </div>

        <div data-err={!!err.fields.accept_terms}><TermsCheck checked={terms} onChange={setTerms} error={err.fields.accept_terms} /></div>
        {Object.keys(err.fields).length > 0 && !err.message && <Alert tone="bad">{t('ยังกรอกไม่ครบ กรุณาดูช่องที่มีข้อความสีแดง', 'Some details are missing — see the red messages')}</Alert>}
        <ErrorBanner message={err.message} />
        <Button type="submit" size="lg" variant="accent" loading={busy} className="w-full text-lg"><Send className="h-5 w-5" />{t('ส่งคำขอประเมินราคา', 'Send quote request')}</Button>
        <p className="text-center text-[15px] text-neutral-500">{t('ไม่ต้องสมัครสมาชิก · ราคาจริงแจ้งโดยเจ้าหน้าที่หลังดูหน้างาน', 'No account needed · price given after a site visit')}</p>
      </form>
    </>
  );
}
