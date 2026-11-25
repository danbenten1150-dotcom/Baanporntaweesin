'use client';

import { useMemo, useState } from 'react';
import { Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { IS_DEMO } from '@/lib/config';
import type { Order } from '@/lib/types';
import { formatTHB } from '@/lib/utils';
import { Alert, Button, Checkbox, EmptyState, Field, Input, LinkButton, PageHeader, PhotoSlot, Select, Skeleton, Textarea } from '@/components/ui';
import { ContactFields, downloadSummary, ErrorBanner, SuccessPanel, TermsCheck, useContactState, useSubmitError } from '@/components/shared/forms';

export default function View() {
  const { t, lang } = useLang();
  const { data: store, loading } = useQuery(() => api.getStore(), []);
  const cart = useCart();
  const [delivery, setDelivery] = useState('');
  const [withTransport, setWithTransport] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useContactState();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Order | null>(null);
  const err = useSubmitError();

  const lines = useMemo(() => cart.lines.map((l) => ({ ...l, p: store?.products.find((p) => p.id === l.product_id) })).filter((l) => l.p), [cart.lines, store]);
  const allPriced = lines.length > 0 && lines.every((l) => l.p!.price != null);
  const subtotal = allPriced ? lines.reduce((s, l) => s + l.qty * (l.p!.price as number), 0) : null;
  const isBulk = lines.reduce((s, l) => s + l.qty, 0) >= 20 || contact.type === 'company';

  const submit = async () => {
    err.reset();
    setBusy(true);
    try {
      const o = await api.createOrder({ lines: cart.lines, delivery_location: delivery, with_transport: withTransport, route_id: withTransport ? routeId || null : null, notes, contact, accept_terms: terms as true });
      setDone(o); cart.clear(); window.scrollTo({ top: 0 });
    } catch (e) { err.handle(e); } finally { setBusy(false); }
  };

  if (done) return (
    <>
      <PageHeader title={t('ส่งคำสั่งซื้อแล้ว', 'Order request sent')} />
      <div className="container max-w-3xl py-10">
        <SuccessPanel title={t('ได้รับคำขอสั่งซื้อวัสดุแล้ว', 'Materials order received')} refNo={done.ref}
          onDownload={() => downloadSummary({ title: t('คำขอสั่งซื้อวัสดุก่อสร้าง', 'Construction materials order request'), ref: done.ref, demo: IS_DEMO,
            rows: [...done.items.map((i) => ({ label: i.name, value: `${i.qty} ${i.unit}${i.unit_price != null ? ` × ${formatTHB(i.unit_price, lang)}` : ''}` })), { label: t('จัดส่งที่', 'Deliver to'), value: done.delivery_location }, { label: t('ยอดรวม', 'Subtotal'), value: done.subtotal != null ? formatTHB(done.subtotal, lang) : t('รอใบเสนอราคา', 'Awaiting quotation') }],
            note: t('ราคาสุทธิและค่าขนส่งจะระบุในใบเสนอราคาจากเจ้าหน้าที่', 'Final price and delivery cost will be stated in the staff quotation.') })}>
          <p className="text-neutral-600">{t('เจ้าหน้าที่จะตรวจสอบสินค้า ค่าจัดส่ง และส่งใบเสนอราคาให้ท่านในบัญชีของฉัน', 'Our team will check stock and delivery cost and send a quotation to your account.')}</p>
        </SuccessPanel>
      </div>
    </>
  );

  return (
    <>
      <PageHeader eyebrow={t('ตะกร้าสินค้า', 'Cart')} title={t('ตะกร้าวัสดุก่อสร้าง', 'Materials cart')} lead={t('ส่งคำขอใบเสนอราคาพร้อมค่าจัดส่ง — ยังไม่มีการตัดเงิน', 'Send a quotation request including delivery — no payment is taken.')} />
      <div className="container grid gap-8 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {loading && <Skeleton className="h-40" />}
          {!loading && lines.length === 0 && <EmptyState title={t('ตะกร้ายังว่างอยู่', 'Your cart is empty')} action={<LinkButton href="/materials/"><ShoppingCart className="h-4 w-4" />{t('เลือกวัสดุก่อสร้าง', 'Browse materials')}</LinkButton>} />}
          {lines.map(({ p, qty }) => (
            <div key={p!.id} className="card flex gap-4 p-3 sm:p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24"><PhotoSlot src={p!.image_url} alt={p!.name_th} icon={Package} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{lang === 'th' ? p!.name_th : p!.name_en}</p>
                  <button onClick={() => cart.remove(p!.id)} className="rounded p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600" aria-label={t('ลบสินค้า', 'Remove')}><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="text-sm text-neutral-500">{p!.price != null ? `${formatTHB(p!.price, lang)} / ${lang === 'th' ? p!.unit_th : p!.unit_en}` : t('รอใบเสนอราคา', 'Price on quotation')}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button className="grid h-9 w-9 place-items-center rounded-lg border" onClick={() => cart.setQty(p!.id, qty - 1)} aria-label="-"><Minus className="h-4 w-4" /></button>
                  <Input type="number" min={0.5} step="0.5" value={qty} onChange={(e) => cart.setQty(p!.id, Number(e.target.value) || 1)} className="h-9 w-20 text-center" aria-label={t('จำนวน', 'Quantity')} />
                  <button className="grid h-9 w-9 place-items-center rounded-lg border" onClick={() => cart.setQty(p!.id, qty + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
                  <span className="text-sm text-neutral-500">{lang === 'th' ? p!.unit_th : p!.unit_en}</span>
                </div>
              </div>
            </div>
          ))}
          {lines.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between"><span className="text-neutral-600">{t('ยอดรวมสินค้า', 'Subtotal')}</span>
                <span className="font-display text-xl font-bold">{subtotal != null ? formatTHB(subtotal, lang) : t('รอใบเสนอราคา', 'On quotation')}</span></div>
              {subtotal == null && <p className="mt-1 text-sm text-neutral-500">{t('บางรายการยังไม่มีราคาที่ยืนยัน ระบบจะไม่คำนวณยอดรวมจนกว่าเจ้าหน้าที่จะเสนอราคา', 'Some items have no verified price, so no total is calculated until staff quote it.')}</p>}
              {isBulk && <Alert tone="info" className="mt-3">{t('คำสั่งซื้อจำนวนมาก/ลูกค้าธุรกิจ: เจ้าหน้าที่จะเสนอราคาพิเศษสำหรับผู้รับเหมา', 'Bulk / business order: our team will prepare contractor pricing.')}</Alert>}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <form className="card h-fit space-y-5 p-5 md:p-6" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <h2 className="font-display text-xl font-bold">{t('การจัดส่งและข้อมูลผู้สั่ง', 'Delivery & contact')}</h2>
            <Field label={t('สถานที่จัดส่ง', 'Delivery location')} required error={err.fields.delivery_location}><Textarea className="min-h-[80px]" value={delivery} onChange={(e) => setDelivery(e.target.value)} invalid={!!err.fields.delivery_location} /></Field>
            <Checkbox checked={withTransport} onChange={setWithTransport}>{t('ต้องการให้จัดส่งทางเรือ/รถพร้อมวัสดุ', 'Arrange ship/truck transport with the materials')}</Checkbox>
            {withTransport && (
              <Field label={t('เส้นทางเรือ (ถ้ามี)', 'Sea route (if needed)')}>
                <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                  <option value="">{t('ไม่ต้องใช้เรือ / ให้เจ้าหน้าที่แนะนำ', 'No ship / let staff advise')}</option>
                  {store?.routes.map((r) => <option key={r.id} value={r.id}>{lang === 'th' ? r.name_th : r.name_en}</option>)}
                </Select>
              </Field>
            )}
            <Field label={t('หมายเหตุ', 'Notes')}><Textarea className="min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <ContactFields value={contact} onChange={setContact} errors={err.fields} />
            <TermsCheck checked={terms} onChange={setTerms} error={err.fields.accept_terms} />
            <ErrorBanner message={err.message} />
            <Button type="submit" size="lg" variant="accent" loading={busy} className="w-full">{t('ส่งคำขอใบเสนอราคา', 'Request quotation')}</Button>
          </form>
        )}
      </div>
    </>
  );
}
