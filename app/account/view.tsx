'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Download, FileText, LogOut, Plus, Trash2, Upload } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { api, quotationTotal, useQuery } from '@/lib/data';
import { IS_DEMO } from '@/lib/config';
import { BOOKING_FLOW, CARGO_CATEGORY, CONSTRUCTION_SERVICE, MACHINERY_TYPE, PAYMENT_STATUS, QUOTATION_STATUS } from '@/lib/labels';
import type { Payment, Quotation, UserProfile } from '@/lib/types';
import { formatDate, formatTHB } from '@/lib/utils';
import { Alert, Badge, Button, DemoTag, EmptyState, Field, FilePicker, Input, LinkButton, Modal, PageHeader, Segmented, Select, Spinner, StatusBadge, Tabs, useToast } from '@/components/ui';
import { downloadSummary, Timeline } from '@/components/shared/forms';
import { useSettings } from '@/components/layout/SiteChrome';
import { SLEEPER_DIR, dateLabel } from '@/lib/sleeper';

type TabId = 'overview' | 'cargo' | 'sleeper' | 'construction' | 'machinery' | 'orders' | 'quotations' | 'payments' | 'documents' | 'profile';

export function downloadQuotation(q: Quotation, lang: 'th' | 'en', invoice = false) {
  const { sub, vat, total } = quotationTotal(q);
  downloadSummary({
    title: invoice ? (lang === 'th' ? 'ใบแจ้งหนี้' : 'Invoice') : (lang === 'th' ? 'ใบเสนอราคา' : 'Quotation'),
    ref: invoice ? q.ref.replace('-Q-', '-INV-') : q.ref, demo: !!q.is_demo,
    rows: [
      { label: lang === 'th' ? 'อ้างอิงงาน' : 'For', value: q.target_ref },
      ...q.items.map((i) => ({ label: i.description, value: `${i.qty} ${i.unit} × ${formatTHB(i.unit_price, lang)} = ${formatTHB(i.qty * i.unit_price, lang)}` })),
      { label: lang === 'th' ? 'รวมก่อนภาษี' : 'Subtotal', value: formatTHB(sub, lang) },
      { label: `VAT ${q.vat_rate}%`, value: formatTHB(vat, lang) },
      { label: lang === 'th' ? 'ยอดรวมทั้งสิ้น' : 'Total', value: formatTHB(total, lang) },
      ...(q.deposit_percent != null ? [{ label: lang === 'th' ? `มัดจำ ${q.deposit_percent}%` : `Deposit ${q.deposit_percent}%`, value: formatTHB(Math.round(total * q.deposit_percent) / 100, lang) }] : []),
      ...(q.valid_until ? [{ label: lang === 'th' ? 'ยืนราคาถึง' : 'Valid until', value: q.valid_until }] : []),
    ],
    note: q.notes || (lang === 'th' ? 'ราคาเป็นสกุลเงินบาท' : 'Prices in Thai Baht'),
  });
}

export default function View() {
  const { t, lang, pick } = useLang();
  const { user, loading: authLoading, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const [tab, setTab] = useState<TabId>('overview');
  const { data, loading } = useQuery(() => (user ? api.customerBundle(user.phone) : Promise.resolve(null)), [user?.phone]);
  const [payFor, setPayFor] = useState<Quotation | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newAddr, setNewAddr] = useState('');

  useEffect(() => { if (!authLoading && !user) router.replace('/login/'); }, [authLoading, user, router]);
  useEffect(() => { if (user) setProfile(user); }, [user]);

  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;
  const docs = useMemo(() => [
    ...(data?.quotations || []).map((q) => ({ id: q.id, name: `${t('ใบเสนอราคา', 'Quotation')} ${q.ref}`, date: q.created_at, act: () => downloadQuotation(q, lang) })),
    ...(data?.quotations || []).filter((q) => q.status === 'accepted').map((q) => ({ id: q.id + 'i', name: `${t('ใบแจ้งหนี้', 'Invoice')} ${q.ref.replace('-Q-', '-INV-')}`, date: q.created_at, act: () => downloadQuotation(q, lang, true) })),
    ...(data?.cargo || []).map((b) => ({ id: b.id, name: `${t('สรุปการจองเรือ', 'Booking summary')} ${b.ref}`, date: b.created_at, act: () => downloadSummary({ title: t('สรุปการจองเรือ', 'Cargo booking summary'), ref: b.ref, demo: !!b.is_demo, rows: [{ label: t('สถานะ', 'Status'), value: b.status }, ...b.items.map((i, n) => ({ label: `#${n + 1}`, value: `${pick(CARGO_CATEGORY[i.category])} · ${i.description} · ${i.weight} ${i.weight_unit}` }))], note: '' }) })),
  ], [data, lang, t, pick]);

  if (authLoading || !user) return <Spinner />;

  const tabs: { value: TabId; label: string; count?: number }[] = [
    { value: 'overview', label: t('ภาพรวม', 'Overview'), count: unread || undefined },
    { value: 'cargo', label: t('การจองเรือ', 'Ship bookings'), count: data?.cargo.length },
    { value: 'sleeper', label: t('ตั๋วเรือนอน', 'Sleeper boat'), count: data?.sleeper?.length },
    { value: 'construction', label: t('งานก่อสร้าง', 'Construction'), count: data?.construction.length },
    { value: 'machinery', label: t('เช่าเครื่องจักร', 'Machinery'), count: data?.machinery.length },
    { value: 'orders', label: t('ซื้อวัสดุ', 'Materials'), count: data?.orders.length },
    { value: 'quotations', label: t('ใบเสนอราคา', 'Quotations'), count: data?.quotations.length },
    { value: 'payments', label: t('การชำระเงิน', 'Payments'), count: data?.payments.length },
    { value: 'documents', label: t('เอกสาร', 'Documents') },
    { value: 'profile', label: t('ข้อมูลส่วนตัว', 'Profile') },
  ];

  const respond = async (q: Quotation, accept: boolean) => {
    try { await api.respondQuotation(q.id, accept, user.phone); toast(accept ? t('ยอมรับใบเสนอราคาแล้ว', 'Quotation accepted') : t('ปฏิเสธใบเสนอราคาแล้ว', 'Quotation rejected')); }
    catch { toast(t('ดำเนินการไม่สำเร็จ', 'Action failed'), 'bad'); }
  };

  return (
    <>
      <PageHeader eyebrow={t('บัญชีของฉัน', 'My account')} title={`${t('สวัสดี', 'Hello')}, ${user.full_name}`} lead={`${user.phone || user.email || ''}${user.account_type === 'company' ? ` · ${user.company_name || t('ลูกค้าธุรกิจ', 'Business')}` : ''}`}>
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton href="/booking/" variant="accent">{t('จองเรือใหม่', 'New booking')}</LinkButton>
          <Button variant="outline" onClick={async () => { await signOut(); router.push('/'); }}><LogOut className="h-4 w-4" />{t('ออกจากระบบ', 'Log out')}</Button>
        </div>
      </PageHeader>
      <div className="container py-8">
        <Tabs value={tab} onChange={setTab} items={tabs} />
        <div className="mt-6">
          {loading && <Spinner />}
          {!loading && data && (
            <>
              {tab === 'overview' && (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      [t('การจองเรือ', 'Ship bookings'), data.cargo.length, 'cargo'], [t('คำของานก่อสร้าง', 'Construction'), data.construction.length, 'construction'],
                      [t('ใบเสนอราคารอตอบ', 'Quotes to answer'), data.quotations.filter((q) => q.status === 'sent').length, 'quotations'], [t('รอตรวจสลิป', 'Slips in review'), data.payments.filter((p) => p.status === 'pending').length, 'payments'],
                    ].map(([l, n, to]) => (
                      <button key={String(to)} onClick={() => setTab(to as TabId)} className="card p-5 text-left hover:border-brand-red">
                        <p className="font-display text-3xl font-bold">{n}</p><p className="mt-1 text-sm text-neutral-600">{l}</p>
                      </button>
                    ))}
                  </div>
                  <div className="card p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Bell className="h-5 w-5 text-brand-red" />{t('การแจ้งเตือน', 'Notifications')}</h2>
                      {unread > 0 && <Button size="sm" variant="ghost" onClick={() => api.markNotificationsRead(user.phone, 'customer')}>{t('อ่านทั้งหมด', 'Mark all read')}</Button>}
                    </div>
                    <ul className="mt-3 max-h-80 divide-y overflow-y-auto">
                      {data.notifications.length === 0 && <li className="py-6 text-center text-sm text-neutral-500">{t('ยังไม่มีการแจ้งเตือน', 'No notifications yet')}</li>}
                      {data.notifications.map((n) => (
                        <li key={n.id} className="flex gap-3 py-3">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-neutral-200' : 'bg-brand-red'}`} />
                          <div className="min-w-0"><p className="text-sm font-medium">{lang === 'th' ? n.title_th : n.title_en}</p><p className="truncate text-xs text-neutral-500">{n.body} · {formatDate(n.created_at, lang, true)}</p></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'cargo' && (data.cargo.length === 0 ? <EmptyState title={t('ยังไม่มีการจองเรือ', 'No ship bookings yet')} action={<LinkButton href="/booking/">{t('จองเรือ', 'Book now')}</LinkButton>} /> : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.cargo.map((b) => (
                    <div key={b.id} className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="font-mono font-bold">{b.ref}</p><p className="text-sm text-neutral-500">{formatDate(b.created_at, lang)} · {b.items.map((i) => pick(CARGO_CATEGORY[i.category])).join(', ')}</p></div>
                        <div className="flex flex-wrap gap-1.5"><StatusBadge status={b.status} /><Badge tone="neutral">{pick(PAYMENT_STATUS[b.payment_status])}</Badge>{b.is_demo && <DemoTag />}</div>
                      </div>
                      <p className="mt-3 text-sm">{t('ราคา', 'Price')}: <strong>{b.price != null ? formatTHB(b.price, lang) : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting staff price')}</strong></p>
                      <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-red">{t('ดูสถานะ', 'View progress')}</summary><div className="mt-4"><Timeline flow={BOOKING_FLOW} history={b.history} current={b.status} /></div></details>
                    </div>
                  ))}
                </div>
              ))}

              {tab === 'construction' && (data.construction.length === 0 ? <EmptyState title={t('ยังไม่มีคำของานก่อสร้าง', 'No construction requests')} action={<LinkButton href="/construction/">{t('ขอใบเสนอราคา', 'Request a quote')}</LinkButton>} /> : (
                <div className="grid gap-4 lg:grid-cols-2">{data.construction.map((c) => (
                  <div key={c.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono font-bold">{c.ref}</p><p className="text-sm text-neutral-500">{pick(CONSTRUCTION_SERVICE[c.project_type])} · {c.location}</p></div><StatusBadge status={c.status} /></div>
                    {c.inspection_date && <p className="mt-3 text-sm">{t('นัดสำรวจ', 'Inspection')}: <strong>{formatDate(c.inspection_date + 'T09:00:00+07:00', lang)}</strong></p>}
                    <div className="mt-3"><div className="flex justify-between text-xs text-neutral-500"><span>{t('ความคืบหน้า', 'Progress')}</span><span>{c.progress}%</span></div><div className="mt-1 h-2 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-red" style={{ width: `${c.progress}%` }} /></div></div>
                  </div>
                ))}</div>
              ))}

              {tab === 'sleeper' && (!data.sleeper?.length ? <EmptyState title={t('ยังไม่มีการจองตั๋วเรือนอน', 'No sleeper-boat bookings')} action={<LinkButton href="/sleeper/">{t('จองตั๋วเรือนอน', 'Book sleeper boat')}</LinkButton>} /> : (
                <div className="grid gap-4 lg:grid-cols-2">{data.sleeper.map((b) => (
                  <div key={b.id} className="card flex flex-wrap items-start justify-between gap-2 p-5"><div><p className="font-mono font-bold">{b.ref}</p><p className="text-[15px] text-neutral-600">{lang === 'th' ? SLEEPER_DIR[b.direction].th : SLEEPER_DIR[b.direction].en} · {dateLabel(b.travel_date, lang, true)} · {b.seats} {t('ท่าน', 'pax')}</p><p className="text-[15px] font-semibold">{b.price != null ? formatTHB(b.price, lang) : t('รอเจ้าหน้าที่ยืนยันราคา', 'Awaiting staff price')}</p></div><StatusBadge status={b.status} /></div>
                ))}</div>
              ))}
              {tab === 'machinery' && (data.machinery.length === 0 ? <EmptyState title={t('ยังไม่มีการเช่าเครื่องจักร', 'No machinery bookings')} action={<LinkButton href="/machinery/">{t('ขอเช่า', 'Request rental')}</LinkButton>} /> : (
                <div className="grid gap-4 lg:grid-cols-2">{data.machinery.map((m) => (
                  <div key={m.id} className="card flex flex-wrap items-start justify-between gap-2 p-5"><div><p className="font-mono font-bold">{m.ref}</p><p className="text-sm text-neutral-500">{pick(MACHINERY_TYPE[m.machinery_type])} · {m.location} · {m.start_date} · {m.duration} {m.rate_unit === 'day' ? t('วัน', 'd') : t('ชม.', 'h')}</p></div><StatusBadge status={m.status} /></div>
                ))}</div>
              ))}

              {tab === 'orders' && (data.orders.length === 0 ? <EmptyState title={t('ยังไม่มีประวัติการซื้อวัสดุ', 'No material purchases yet')} action={<LinkButton href="/materials/">{t('เลือกวัสดุ', 'Browse materials')}</LinkButton>} /> : (
                <div className="space-y-3">{data.orders.map((o) => (
                  <div key={o.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono font-bold">{o.ref}</p><p className="text-sm text-neutral-500">{formatDate(o.created_at, lang)} · {o.items.length} {t('รายการ', 'items')}</p></div><div className="flex gap-1.5"><StatusBadge status={o.status} /><Badge>{pick(PAYMENT_STATUS[o.payment_status])}</Badge></div></div>
                    <p className="mt-2 text-sm">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p>
                    <p className="mt-1 text-sm">{t('ยอดรวม', 'Total')}: <strong>{o.subtotal != null ? formatTHB(o.subtotal, lang) : t('รอใบเสนอราคา', 'On quotation')}</strong></p>
                  </div>
                ))}</div>
              ))}

              {tab === 'quotations' && (data.quotations.length === 0 ? <EmptyState title={t('ยังไม่มีใบเสนอราคา', 'No quotations yet')} body={t('ใบเสนอราคาจากเจ้าหน้าที่จะแสดงที่นี่', 'Quotations from our team will appear here.')} /> : (
                <div className="space-y-4">{data.quotations.map((q) => { const { sub, vat, total } = quotationTotal(q); return (
                  <div key={q.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-mono font-bold">{q.ref}</p><p className="text-sm text-neutral-500">{t('สำหรับ', 'For')} {q.target_ref} · {formatDate(q.created_at, lang)}{q.valid_until && ` · ${t('ยืนราคาถึง', 'valid until')} ${q.valid_until}`}</p></div>
                      <div className="flex gap-1.5"><Badge tone={q.status === 'accepted' ? 'ok' : q.status === 'rejected' ? 'bad' : 'warn'}>{pick(QUOTATION_STATUS[q.status])}</Badge>{q.is_demo && <DemoTag />}</div>
                    </div>
                    <div className="scroll mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-sm">
                      <thead><tr className="border-b text-left text-neutral-500"><th className="py-2 font-medium">{t('รายการ', 'Item')}</th><th className="py-2 text-right font-medium">{t('จำนวน', 'Qty')}</th><th className="py-2 text-right font-medium">{t('ราคา/หน่วย', 'Unit price')}</th><th className="py-2 text-right font-medium">{t('รวม', 'Amount')}</th></tr></thead>
                      <tbody>{q.items.map((i, n) => <tr key={n} className="border-b border-neutral-100"><td className="py-2">{i.description}</td><td className="whitespace-nowrap py-2 text-right tabular-nums">{i.qty} {i.unit}</td><td className="whitespace-nowrap py-2 text-right tabular-nums">{formatTHB(i.unit_price, lang)}</td><td className="whitespace-nowrap py-2 text-right tabular-nums">{formatTHB(i.qty * i.unit_price, lang)}</td></tr>)}</tbody>
                      <tfoot className="tabular-nums"><tr><td colSpan={3} className="pt-2 text-right text-neutral-500">{t('รวมก่อนภาษี', 'Subtotal')}</td><td className="whitespace-nowrap pt-2 text-right">{formatTHB(sub, lang)}</td></tr>
                        <tr><td colSpan={3} className="text-right text-neutral-500">VAT {q.vat_rate}%</td><td className="whitespace-nowrap text-right">{formatTHB(vat, lang)}</td></tr>
                        <tr><td colSpan={3} className="text-right font-semibold">{t('ยอดรวมทั้งสิ้น', 'Total')}</td><td className="whitespace-nowrap text-right font-display text-lg font-bold text-brand-red">{formatTHB(total, lang)}</td></tr></tfoot>
                    </table></div>
                    {q.notes && <p className="mt-3 text-sm text-neutral-600">{q.notes}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadQuotation(q, lang)}><Download className="h-4 w-4" />{t('ดาวน์โหลด', 'Download')}</Button>
                      {q.status === 'sent' && <><Button size="sm" onClick={() => respond(q, true)}>{t('ยอมรับ', 'Accept')}</Button><Button size="sm" variant="danger" onClick={() => respond(q, false)}>{t('ปฏิเสธ', 'Reject')}</Button></>}
                      {q.status === 'accepted' && <Button size="sm" variant="accent" onClick={() => setPayFor(q)}><Upload className="h-4 w-4" />{t('แจ้งชำระเงิน', 'Submit payment')}</Button>}
                    </div>
                  </div>
                ); })}</div>
              ))}

              {tab === 'payments' && (data.payments.length === 0 ? <EmptyState title={t('ยังไม่มีประวัติการชำระเงิน', 'No payments yet')} body={t('แจ้งชำระเงินได้จากใบเสนอราคาที่ยอมรับแล้ว', 'Submit payments from an accepted quotation.')} /> : (
                <div className="card scroll overflow-x-auto"><table className="stack w-full text-sm">
                  <thead><tr className="border-b bg-neutral-50 text-left text-neutral-500"><th className="p-3 font-medium">{t('เลขที่', 'Ref')}</th><th className="p-3 font-medium">{t('สำหรับ', 'For')}</th><th className="p-3 text-right font-medium">{t('จำนวนเงิน', 'Amount')}</th><th className="p-3 font-medium">{t('ประเภท', 'Type')}</th><th className="p-3 font-medium">{t('สถานะ', 'Status')}</th><th className="p-3 font-medium">{t('วันที่', 'Date')}</th></tr></thead>
                  <tbody>{data.payments.map((p: Payment) => <tr key={p.id} className="border-b border-neutral-100"><td className="p-3 font-mono">{p.ref}</td><td className="p-3">{p.target_ref}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{formatTHB(p.amount, lang)}</td><td className="p-3">{p.payment_type === 'deposit' ? t('มัดจำ', 'Deposit') : p.payment_type === 'balance' ? t('ส่วนที่เหลือ', 'Balance') : t('เต็มจำนวน', 'Full')}</td><td className="p-3"><StatusBadge status={p.status} /></td><td className="p-3">{formatDate(p.created_at, lang)}</td></tr>)}</tbody>
                </table></div>
              ))}

              {tab === 'documents' && (docs.length === 0 ? <EmptyState title={t('ยังไม่มีเอกสาร', 'No documents yet')} /> : (
                <ul className="grid gap-3 md:grid-cols-2">{docs.map((d) => (
                  <li key={d.id} className="card flex items-center gap-3 p-4"><FileText className="h-6 w-6 shrink-0 text-brand-red" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{d.name}</p><p className="text-xs text-neutral-500">{formatDate(d.date, lang)}</p></div><Button size="sm" variant="outline" onClick={d.act}><Download className="h-4 w-4" /></Button></li>
                ))}</ul>
              ))}

              {tab === 'profile' && profile && (
                <form className="card grid max-w-3xl gap-4 p-5 sm:grid-cols-2 md:p-8" onSubmit={async (e) => { e.preventDefault(); await updateProfile(profile); toast(t('บันทึกข้อมูลแล้ว', 'Profile saved')); }}>
                  <div className="sm:col-span-2"><Segmented value={profile.account_type} onChange={(v) => setProfile({ ...profile, account_type: v })} options={[{ value: 'individual', label: t('บุคคลทั่วไป', 'Individual') }, { value: 'company', label: t('บริษัท', 'Company') }]} /></div>
                  <Field label={t('ชื่อ-นามสกุล', 'Full name')}><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></Field>
                  <Field label={t('เบอร์โทรศัพท์', 'Phone')} hint={IS_DEMO ? t('ในโหมดสาธิต เบอร์ใช้เป็นตัวระบุบัญชี', 'In demo mode the phone identifies the account') : undefined}><Input value={profile.phone} disabled={IS_DEMO} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
                  <Field label={t('อีเมล', 'Email')}><Input type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
                  {profile.account_type === 'company' && <>
                    <Field label={t('ชื่อบริษัท', 'Company name')}><Input value={profile.company_name || ''} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} /></Field>
                    <Field label={t('เลขประจำตัวผู้เสียภาษี', 'Tax ID')}><Input value={profile.tax_id || ''} maxLength={13} inputMode="numeric" onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })} /></Field>
                  </>}
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium">{t('ที่อยู่จัดส่งที่บันทึกไว้', 'Saved delivery addresses')}</p>
                    <ul className="space-y-2">{profile.addresses.map((a, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm">{a}<button type="button" onClick={() => setProfile({ ...profile, addresses: profile.addresses.filter((_, j) => j !== i) })} aria-label={t('ลบ', 'Remove')}><Trash2 className="h-4 w-4 text-neutral-500" /></button></li>)}</ul>
                    <div className="mt-2 flex gap-2"><Input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder={t('เพิ่มที่อยู่ใหม่', 'Add an address')} /><Button type="button" variant="outline" onClick={() => { if (newAddr.trim()) { setProfile({ ...profile, addresses: [...profile.addresses, newAddr.trim()] }); setNewAddr(''); } }}><Plus className="h-4 w-4" /></Button></div>
                  </div>
                  <div className="sm:col-span-2"><Button type="submit">{t('บันทึก', 'Save')}</Button></div>
                  <p className="text-xs text-neutral-500 sm:col-span-2">{t('ต้องการขอสำเนา แก้ไข หรือลบข้อมูลส่วนบุคคล (PDPA) กรุณาติดต่อเราผ่านหน้าติดต่อเรา', 'To request a copy, correction or deletion of your personal data (PDPA), contact us via the contact page.')}</p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
      <PaymentModal q={payFor} onClose={() => setPayFor(null)} phone={user.phone} bank={settings} />
    </>
  );
}

function PaymentModal({ q, onClose, phone, bank }: { q: Quotation | null; onClose: () => void; phone: string; bank: ReturnType<typeof useSettings> }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const [type, setType] = useState<'deposit' | 'full' | 'balance'>('full');
  const [method, setMethod] = useState<'bank_transfer' | 'promptpay'>('bank_transfer');
  const [amount, setAmount] = useState('');
  const [slip, setSlip] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q) { const { total } = quotationTotal(q); setAmount(String(type === 'deposit' && q.deposit_percent != null ? Math.round(total * q.deposit_percent) / 100 : total)); } }, [q, type]);
  if (!q) return null;
  const bankReady = !!(bank?.bank_account_no && bank.bank_name);
  const ppReady = !!bank?.promptpay_id;
  return (
    <Modal open onClose={onClose} title={t('แจ้งชำระเงิน', 'Submit payment')}>
      <div className="space-y-4">
        <p className="text-sm">{t('ใบเสนอราคา', 'Quotation')} <strong className="font-mono">{q.ref}</strong> → {q.target_ref}</p>
        <Segmented value={type} onChange={setType} options={[{ value: 'full', label: t('เต็มจำนวน', 'Full') }, { value: 'deposit', label: t('มัดจำ', 'Deposit') }, { value: 'balance', label: t('ส่วนที่เหลือ', 'Balance') }]} />
        <Field label={t('ช่องทาง', 'Method')}><Select value={method} onChange={(e) => setMethod(e.target.value as 'bank_transfer' | 'promptpay')}><option value="bank_transfer">{t('โอนเงินผ่านธนาคาร', 'Bank transfer')}</option><option value="promptpay" disabled={!ppReady}>PromptPay{!ppReady ? ` (${t('ยังไม่เปิดใช้', 'not configured')})` : ''}</option></Select></Field>
        {method === 'bank_transfer' && (bankReady ? <Alert tone="info"><p className="font-semibold">{bank!.bank_name}</p><p>{bank!.bank_account_name}</p><p className="font-mono text-base">{bank!.bank_account_no}</p></Alert>
          : <Alert>{t('ยังไม่ได้ตั้งค่าบัญชีธนาคารของบริษัท กรุณาติดต่อเจ้าหน้าที่ก่อนโอนเงิน', 'Company bank account not configured yet — contact our team before transferring.')}</Alert>)}
        {method === 'promptpay' && ppReady && <Alert tone="info">PromptPay ID: <span className="font-mono">{bank!.promptpay_id}</span></Alert>}
        <Field label={t('จำนวนเงินที่โอน (บาท)', 'Amount transferred (THB)')} required><Input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <FilePicker label={t('สลิปการโอนเงิน', 'Transfer slip')} files={slip} onChange={(f) => setSlip(f.slice(-1))} accept="image/jpeg,image/png,application/pdf" />
        <p className="text-xs text-neutral-500">{t('การชำระเงินจะได้รับการยืนยันหลังเจ้าหน้าที่ตรวจสอบสลิปแล้วเท่านั้น', 'Payment is confirmed only after staff verify the slip.')}</p>
        <Button className="w-full" size="lg" loading={busy} disabled={!slip.length || !(Number(amount) > 0)} onClick={async () => {
          setBusy(true);
          try {
            const [path] = await api.uploadFiles(slip, 'payments');
            await api.submitPayment({ target_kind: q.kind, target_ref: q.target_ref, customer_phone: phone, amount: Number(amount), payment_type: type, method, slip_name: path });
            toast(t('ส่งสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ', 'Slip submitted — awaiting verification')); onClose(); setSlip([]);
          } catch { toast(t('ส่งไม่สำเร็จ', 'Submission failed'), 'bad'); } finally { setBusy(false); }
        }}><Upload className="h-4 w-4" />{t('ส่งสลิป', 'Submit slip')}</Button>
        <p className="text-center text-xs text-neutral-500">{formatTHB(Number(amount) || 0, lang)}</p>
      </div>
    </Modal>
  );
}
