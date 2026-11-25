'use client';

import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { BOOKING_FLOW, PAYMENT_STATUS } from '@/lib/labels';
import type { TrackResult } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Alert, Button, Field, Input, PageHeader, StatusBadge } from '@/components/ui';
import { SupportBox, Timeline } from '@/components/shared/forms';

const FLOWS: Record<TrackResult['kind'], string[]> = {
  cargo: BOOKING_FLOW,
  construction: ['submitted', 'contacted', 'inspection_scheduled', 'quotation_sent', 'accepted', 'in_progress', 'completed'],
  machinery: ['pending_review', 'awaiting_quotation', 'confirmed', 'in_progress', 'completed'],
  sleeper: ['pending_review', 'confirmed', 'completed'],
  order: ['quotation_requested', 'quoted', 'awaiting_payment', 'confirmed', 'delivering', 'delivered'],
};

export default function View() {
  const { t, lang, pick } = useLang();
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TrackResult | null | undefined>(undefined);

  const search = async (r = ref, p = phone) => {
    setBusy(true);
    try { setRes(await api.track(r, p)); } catch { setRes(null); } finally { setBusy(false); }
  };
  const latest = res?.history[res.history.length - 1];

  return (
    <>
      <PageHeader eyebrow={t('ติดตามสถานะ', 'Track order')} title={t('ติดตามการขนส่งและคำขอบริการ', 'Track your shipment or request')} lead={t('กรอกเลขอ้างอิงและเบอร์โทรศัพท์ที่ใช้จอง เพื่อยืนยันตัวตน', 'Enter your reference and the phone number used to book, to verify it’s you.')} />
      <div className="container grid gap-8 py-10 lg:grid-cols-[400px_1fr]">
        <form className="card h-fit space-y-4 p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <Field label={t('เลขอ้างอิง', 'Reference number')} required><Input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="BPT-C-..." autoCapitalize="characters" className="font-mono" required /></Field>
          <Field label={t('เบอร์โทรศัพท์ที่ใช้จอง', 'Phone used for booking')} required><Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" required /></Field>
          <Button type="submit" size="lg" loading={busy} className="w-full"><Search className="h-4 w-4" />{t('ตรวจสอบสถานะ', 'Check status')}</Button>
          <p className="flex gap-2 text-xs text-neutral-500"><ShieldCheck className="h-4 w-4 shrink-0" />{t('ระบบแสดงข้อมูลเฉพาะเมื่อเลขอ้างอิงและเบอร์โทรตรงกัน', 'Details are shown only when reference and phone match.')}</p>
          {IS_DEMO && (
            <button type="button" className="w-full rounded-xl bg-brand-yellow/30 p-3 text-left text-sm" onClick={() => { setRef('BPT-C-DEMO-0001'); setPhone('0800000000'); search('BPT-C-DEMO-0001', '0800000000'); }}>
              <strong>{t('ลองข้อมูลตัวอย่าง', 'Try demo data')}:</strong> BPT-C-DEMO-0001 · 0800000000
            </button>
          )}
        </form>

        <div>
          {res === undefined && <div className="grid h-full min-h-[240px] place-items-center rounded-2xl border border-dashed text-neutral-500">{t('ผลการค้นหาจะแสดงที่นี่', 'Results will appear here')}</div>}
          {res === null && <Alert tone="bad">{t('ไม่พบข้อมูล กรุณาตรวจสอบเลขอ้างอิงและเบอร์โทรศัพท์อีกครั้ง', 'Nothing found. Please check the reference and phone number.')}</Alert>}
          {res && (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-brand-grey p-5 md:p-6">
                <div>
                  <p className="text-sm text-neutral-500">{lang === 'th' ? res.service_label_th : res.service_label_en}</p>
                  <p className="font-mono text-xl font-bold">{res.ref}</p>
                  {res.route && <p className="mt-1 text-sm">{res.route}</p>}
                </div>
                <StatusBadge status={res.status} />
              </div>
              <dl className="grid gap-4 border-b p-5 text-sm sm:grid-cols-3 md:p-6">
                <div><dt className="text-neutral-500">{t('วันที่คาดว่าจะถึง/ส่งมอบ', 'Estimated delivery')}</dt><dd className="mt-0.5 font-semibold">{res.eta ? formatDate(res.eta, lang, res.kind === 'cargo') : t('รอยืนยัน', 'To be confirmed')}</dd></div>
                <div><dt className="text-neutral-500">{t('อัปเดตล่าสุด', 'Latest update')}</dt><dd className="mt-0.5 font-semibold">{latest ? formatDate(latest.at, lang, true) : '—'}</dd></div>
                <div><dt className="text-neutral-500">{t('การชำระเงิน', 'Payment')}</dt><dd className="mt-0.5 font-semibold">{res.payment_status ? pick(PAYMENT_STATUS[res.payment_status]) : '—'}</dd></div>
              </dl>
              <div className="p-5 md:p-6">
                <Timeline flow={FLOWS[res.kind]} history={res.history} current={res.status} />
                <p className="mt-6 text-xs text-neutral-500">{t('สถานะอัปเดตโดยเจ้าหน้าที่ ระบบยังไม่มีการติดตามตำแหน่ง GPS แบบเรียลไทม์', 'Statuses are updated by staff. Live GPS tracking is not connected.')}</p>
              </div>
            </div>
          )}
          <div className="mt-6"><SupportBox /></div>
        </div>
      </div>
    </>
  );
}
