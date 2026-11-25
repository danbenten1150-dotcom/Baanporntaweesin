'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Anchor, CheckCircle2, ClipboardCheck, Download, Headphones, Inbox, MapPin, PackageCheck, Phone, Ship, XCircle } from 'lucide-react';
import type { ContactInfo, StatusEvent } from '@/lib/types';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { BusinessError, ValidationError } from '@/lib/validation';
import { ANY_STATUS, BOOKING_FLOW } from '@/lib/labels';
import { cn, downloadFile, escapeHtml, formatDate } from '@/lib/utils';
import { Alert, Button, Checkbox, Field, Input, LinkButton, Segmented } from '@/components/ui';
import { useSettings } from '@/components/layout/SiteChrome';

export const emptyContact = (): ContactInfo => ({ type: 'individual', full_name: '', company_name: '', phone: '', email: '', line_id: '', tax_id: '' });

/** Pre-fills contact details from the signed-in account. */
export function useContactState() {
  const { user } = useAuth();
  const [c, setC] = useState<ContactInfo>(emptyContact());
  useEffect(() => {
    if (user) setC((x) => ({ ...x, type: user.account_type, full_name: x.full_name || user.full_name, phone: x.phone || user.phone, email: x.email || user.email || '', company_name: x.company_name || user.company_name || '', tax_id: x.tax_id || user.tax_id || '' }));
  }, [user]);
  return [c, setC] as const;
}

export function ContactFields({ value, onChange, errors, prefix = 'contact' }: { value: ContactInfo; onChange: (c: ContactInfo) => void; errors: Record<string, string>; prefix?: string }) {
  const { t } = useLang();
  const set = (k: keyof ContactInfo) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const err = (k: string) => errors[`${prefix}.${k}`];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">{t('ประเภทลูกค้า', 'Customer type')}</span>
        <Segmented value={value.type} onChange={(v) => onChange({ ...value, type: v })} options={[{ value: 'individual', label: t('บุคคลทั่วไป', 'Individual') }, { value: 'company', label: t('นิติบุคคล / บริษัท', 'Company') }]} />
      </div>
      <Field label={t('ชื่อ-นามสกุล', 'Full name')} required error={err('full_name')}><Input value={value.full_name} onChange={set('full_name')} autoComplete="name" invalid={!!err('full_name')} /></Field>
      <Field label={t('เบอร์โทรศัพท์', 'Phone number')} required error={err('phone')} hint={t('ใช้สำหรับติดตามสถานะ', 'Used to track your request')}><Input value={value.phone} onChange={set('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="08x xxx xxxx" invalid={!!err('phone')} /></Field>
      <Field label={t('อีเมล', 'Email')} error={err('email')}><Input value={value.email} onChange={set('email')} type="email" autoComplete="email" invalid={!!err('email')} /></Field>
      <Field label="LINE ID"><Input value={value.line_id} onChange={set('line_id')} /></Field>
      {value.type === 'company' && <>
        <Field label={t('ชื่อบริษัท', 'Company name')} required error={err('company_name')}><Input value={value.company_name} onChange={set('company_name')} autoComplete="organization" invalid={!!err('company_name')} /></Field>
        <Field label={t('เลขประจำตัวผู้เสียภาษี', 'Tax ID')} required error={err('tax_id')}><Input value={value.tax_id} onChange={set('tax_id')} inputMode="numeric" maxLength={13} invalid={!!err('tax_id')} /></Field>
      </>}
    </div>
  );
}

export function TermsCheck({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const { t } = useLang();
  return (
    <div>
      <Checkbox checked={checked} onChange={onChange}>
        {t('ข้าพเจ้ายอมรับ', 'I accept the')} <Link href="/terms/" className="font-semibold text-brand-red underline" target="_blank">{t('ข้อกำหนดการใช้บริการ', 'Terms of service')}</Link> {t('และยินยอมให้เก็บข้อมูลตาม', 'and consent to data processing under the')} <Link href="/privacy/" className="font-semibold text-brand-red underline" target="_blank">{t('นโยบายความเป็นส่วนตัว (PDPA)', 'Privacy policy (PDPA)')}</Link>
      </Checkbox>
      {error && <p className="mt-1 text-[13px] text-red-600">{t('กรุณายอมรับเงื่อนไข', 'Please accept the terms')}</p>}
    </div>
  );
}

/** Converts api errors into field errors + a readable message. */
export function useSubmitError() {
  const { lang } = useLang();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const handle = (e: unknown) => {
    if (e instanceof ValidationError) { setFields(e.fields); setMessage(lang === 'th' ? 'กรุณาตรวจสอบข้อมูลที่ไฮไลต์' : 'Please check the highlighted fields'); return; }
    if (e instanceof BusinessError) { setMessage(lang === 'th' ? e.th : e.en); return; }
    setMessage(lang === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' : 'Something went wrong, please try again');
  };
  const reset = () => { setFields({}); setMessage(''); };
  return { fields, message, handle, reset, setFields };
}

export function SupportBox() {
  const { t } = useLang();
  const s = useSettings();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-brand-grey p-5 sm:flex-row sm:items-center">
      <Headphones className="h-8 w-8 shrink-0 text-brand-red" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{t('ต้องการความช่วยเหลือ?', 'Need help?')}</p>
        <p className="text-neutral-600">
          {s?.phone ? <>{t('โทร', 'Call')} <a className="font-semibold text-brand-red" href={`tel:${s.phone}`}>{s.phone}</a></> : t('ติดต่อเจ้าหน้าที่ผ่านหน้าติดต่อเรา', 'Reach our team via the contact page')}
          {s?.line_id && <> · LINE: <strong>{s.line_id}</strong></>}
        </p>
      </div>
      <LinkButton href="/contact/" variant="outline" size="sm"><Phone className="h-4 w-4" />{t('ติดต่อเรา', 'Contact us')}</LinkButton>
    </div>
  );
}

export interface SummaryRow { label: string; value: string }
/** Downloadable, printable HTML summary (open → Print → Save as PDF). */
export function summaryHtml(opts: { title: string; ref: string; rows: SummaryRow[]; note: string; demo: boolean }) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(opts.ref)}</title>
<style>body{font-family:'Noto Sans Thai','Prompt',Arial,sans-serif;color:#171717;max-width:760px;margin:32px auto;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #C00000;padding-bottom:12px}
h1{font-size:22px;margin:0}.ref{font-size:20px;font-weight:700;color:#C00000}table{width:100%;border-collapse:collapse;margin-top:20px}
td{padding:10px;border-bottom:1px solid #eee;vertical-align:top}td:first-child{width:38%;color:#555}
.note{margin-top:20px;padding:12px;background:#FFF8CC;border-left:4px solid #FFD600}.demo{color:#850000;font-weight:700}</style></head><body>
<header><div><h1>บ้านพรทวีสิน · Baan PornTaweesin</h1><div>${escapeHtml(opts.title)}</div></div><div class="ref">${escapeHtml(opts.ref)}</div></header>
${opts.demo ? '<p class="demo">เอกสารสาธิต — ไม่ใช่การจองจริง / DEMO document — not a real booking</p>' : ''}
<table>${opts.rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`).join('')}</table>
<p class="note">${escapeHtml(opts.note)}</p><p style="color:#888;font-size:12px">Generated ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} (Asia/Bangkok)</p></body></html>`;
}
export function downloadSummary(opts: Parameters<typeof summaryHtml>[0]) {
  downloadFile(`${opts.ref}.html`, summaryHtml(opts));
}

export function SuccessPanel({ title, refNo, children, onDownload }: { title: string; refNo: string; children?: React.ReactNode; onDownload?: () => void }) {
  const { t } = useLang();
  return (
    <div className="card overflow-hidden">
      <div className="bg-emerald-600 px-6 py-8 text-center text-white">
        <CheckCircle2 className="mx-auto h-12 w-12" />
        <h2 className="mt-3 font-display text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-white/85">{t('เลขอ้างอิงของคุณ', 'Your reference number')}</p>
        <p className="mt-2 inline-block rounded-xl bg-white px-4 py-2 font-mono text-xl font-bold tracking-wider text-brand-ink">{refNo}</p>
      </div>
      <div className="space-y-5 p-6">
        {children}
        <div className="flex flex-wrap gap-2">
          {onDownload && <Button variant="outline" onClick={onDownload}><Download className="h-4 w-4" />{t('ดาวน์โหลดสรุป', 'Download summary')}</Button>}
          <LinkButton href="/track/" variant="primary">{t('ติดตามสถานะ', 'Track status')}</LinkButton>
          <LinkButton href="/account/" variant="ghost">{t('ไปที่บัญชีของฉัน', 'Go to my account')}</LinkButton>
        </div>
        <SupportBox />
      </div>
    </div>
  );
}

const STEP_TEXT: Record<string, { th: string; en: string; dth: string; den: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending_review: { th: 'ได้รับคำขอจอง', en: 'Request received', dth: 'เราได้รับข้อมูลของคุณแล้ว', den: 'We have your details', icon: Inbox },
  confirmed: { th: 'ตรวจสอบและยืนยัน', en: 'Checked & confirmed', dth: 'เจ้าหน้าที่ยืนยันรอบเรือและพื้นที่แล้ว', den: 'Sailing and space confirmed', icon: ClipboardCheck },
  cargo_received: { th: 'รับสินค้าแล้ว', en: 'Cargo received', dth: 'สินค้าถึงท่าเรือต้นทางแล้ว', den: 'Cargo is at the departure port', icon: PackageCheck },
  loading: { th: 'กำลังขึ้นเรือ', en: 'Loading', dth: 'กำลังนำสินค้าขึ้นเรือ', den: 'Cargo is being loaded', icon: Anchor },
  in_transit: { th: 'อยู่ระหว่างขนส่ง', en: 'In transit', dth: 'เรือออกจากท่าแล้ว', den: 'The ship has left port', icon: Ship },
  arrived: { th: 'ถึงปลายทาง', en: 'Arrived', dth: 'เรือถึงท่าปลายทางแล้ว', den: 'Arrived at destination port', icon: MapPin },
  delivered: { th: 'ส่งมอบเรียบร้อย', en: 'Delivered', dth: 'ส่งมอบสินค้าครบแล้ว', den: 'Cargo handed over', icon: CheckCircle2 },
};

export function Timeline({ flow, history, current }: { flow: string[]; history: StatusEvent[]; current: string }) {
  const { pick, lang, t } = useLang();
  const cancelled = current === 'cancelled' || current === 'rejected';
  // statuses before "confirmed" (awaiting quotation / payment) count as the first step
  const norm = (s: string) => (flow === BOOKING_FLOW && ['awaiting_quotation', 'awaiting_payment'].includes(s) ? 'pending_review' : s);
  const idx = flow.indexOf(norm(current));
  const steps = cancelled ? [...flow.filter((f) => history.some((h) => norm(h.status) === f)), current] : flow;
  const pct = cancelled || idx < 0 ? 0 : Math.round((idx / (flow.length - 1)) * 100);
  return (
    <div>
      {!cancelled && idx >= 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-[15px]"><span className="font-semibold">{t('ความคืบหน้า', 'Progress')}</span><span className="font-semibold text-brand-red">{t(`ขั้นที่ ${idx + 1} จาก ${flow.length}`, `Step ${idx + 1} of ${flow.length}`)}</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand-red" style={{ width: `${Math.max(pct, 6)}%` }} /></div>
        </div>
      )}
      <ol className="relative">
        {steps.map((s, i) => {
          const ev = [...history].reverse().find((h) => norm(h.status) === s);
          const done = cancelled ? true : idx >= 0 ? i <= idx : !!ev;
          const isCurrent = s === norm(current);
          const info = STEP_TEXT[s];
          const Icon = cancelled && isCurrent ? XCircle : info?.icon || CheckCircle2;
          return (
            <li key={s} className="relative flex gap-4 pb-7 last:pb-0" aria-current={isCurrent ? 'step' : undefined}>
              {i < steps.length - 1 && <span className={cn('absolute left-[21px] top-11 h-[calc(100%-36px)] w-[3px] rounded', done && !isCurrent ? 'bg-brand-red' : 'bg-neutral-200')} />}
              <span className={cn('relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px]',
                isCurrent ? (cancelled ? 'border-red-600 bg-red-600 text-white' : 'border-brand-yellow bg-brand-red text-white') : done ? 'border-brand-red bg-brand-red text-white' : 'border-neutral-200 bg-white text-neutral-500')}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="pt-1.5">
                <p className={cn('text-[17px] font-semibold', !done && 'text-neutral-500')}>{info ? t(info.th, info.en) : pick(ANY_STATUS[s]) || s}{isCurrent && !cancelled && <span className="ml-2 rounded-full bg-brand-yellow px-2 py-0.5 text-[13px] font-bold text-brand-ink">{t('ตอนนี้', 'Now')}</span>}</p>
                {info && <p className={cn('text-[15px]', done ? 'text-neutral-600' : 'text-neutral-500')}>{t(info.dth, info.den)}</p>}
                {ev && <p className="text-[14px] text-neutral-500">{formatDate(ev.at, lang, true)}{ev.note && !['DEMO', 'Submitted online'].includes(ev.note) && !ev.note.startsWith('ส่งคำขอ') ? ` · ${ev.note}` : ''}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <Alert tone="bad">{message}</Alert>;
}
