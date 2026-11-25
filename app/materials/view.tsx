'use client';

import { useMemo, useState } from 'react';
import { Package, Search, ShoppingCart, Ship, Truck, Warehouse } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, useQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import type { Product } from '@/lib/types';
import { cn, formatTHB } from '@/lib/utils';
import { Button, DemoTag, EmptyState, Input, LinkButton, Modal, PageHeader, PhotoSlot, Skeleton, useToast } from '@/components/ui';

export function DeliveryIcons({ p }: { p: Product }) {
  const { t } = useLang();
  const map = { pickup: [Warehouse, t('รับเอง', 'Pickup')], truck: [Truck, t('ส่งด้วยรถ', 'Truck')], ship: [Ship, t('ส่งทางเรือ', 'By ship')] } as const;
  return <div className="flex flex-wrap gap-1.5">{p.delivery.map((d) => { const [I, l] = map[d]; return <span key={d} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"><I className="h-3.5 w-3.5" />{l}</span>; })}</div>;
}

export default function View() {
  const { t, lang } = useLang();
  const { data: store, loading } = useQuery(() => api.getStore(), []);
  const cart = useCart();
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const list = useMemo(() => (store?.products || []).filter((p) => p.active && (cat === 'all' || p.category_id === cat) &&
    (!q || `${p.name_th} ${p.name_en} ${p.desc_th}`.toLowerCase().includes(q.toLowerCase()))), [store, cat, q]);

  const add = (p: Product, n = 1) => { cart.add(p.id, n); toast(t(`เพิ่ม ${p.name_th} ลงตะกร้าแล้ว`, `${p.name_en} added to cart`)); };
  const name = (p: Product) => (lang === 'th' ? p.name_th : p.name_en);
  const unit = (p: Product) => (lang === 'th' ? p.unit_th : p.unit_en);

  return (
    <>
      <PageHeader eyebrow={t('วัสดุก่อสร้าง', 'Construction materials')} title={t('หิน ปูน ทราย ท่อ บ่อ และวัสดุก่อสร้างทุกชนิด', 'Stone, cement, sand, pipes, rings and more')} lead={t('เลือกสินค้าใส่ตะกร้า แล้วขอใบเสนอราคาพร้อมค่าจัดส่ง เหมาะสำหรับผู้รับเหมาและสั่งจำนวนมาก', 'Add items to your cart and request a quote including delivery — built for contractors and bulk orders.')}>
        <div className="mt-6 flex flex-wrap gap-3"><LinkButton href="/cart/" variant="accent"><ShoppingCart className="h-4 w-4" />{t('ดูตะกร้า', 'View cart')} ({cart.count})</LinkButton></div>
      </PageHeader>
      <div className="container py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative md:w-80"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-500" /><Input className="pl-10" placeholder={t('ค้นหาสินค้า', 'Search products')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาสินค้า', 'Search products')} /></div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {[{ id: 'all', name_th: 'ทั้งหมด', name_en: 'All' }, ...(store?.categories || [])].map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-medium', cat === c.id ? 'bg-brand-red text-white' : 'bg-neutral-100 hover:bg-neutral-200')}>{lang === 'th' ? c.name_th : c.name_en}</button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
          {!loading && list.map((p) => (
            <article key={p.id} className="card flex flex-col overflow-hidden">
              <button className="relative aspect-[4/3] overflow-hidden text-left" onClick={() => { setOpen(p); setQty(1); }} aria-label={name(p)}>
                <PhotoSlot src={p.image_url} alt={name(p)} label={name(p)} icon={Package} />
                {p.is_demo && <DemoTag className="absolute left-3 top-3" />}
              </button>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold leading-snug">{name(p)}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{lang === 'th' ? p.desc_th : p.desc_en}</p>
                <div className="mt-3"><DeliveryIcons p={p} /></div>
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <div>
                    {p.price != null ? <p className="whitespace-nowrap font-display text-lg font-bold text-brand-red">{formatTHB(p.price, lang)}<span className="text-xs font-normal text-neutral-500"> / {unit(p)}</span></p>
                      : <p className="text-sm font-semibold text-neutral-700">{t('สอบถามราคา', 'Request quotation')}<span className="block text-xs font-normal text-neutral-500">{t('หน่วย', 'Unit')}: {unit(p)}</span></p>}
                  </div>
                  <Button size="sm" onClick={() => add(p)} aria-label={t(`เพิ่ม ${p.name_th}`, `Add ${p.name_en}`)}><ShoppingCart className="h-4 w-4" />{t('เพิ่ม', 'Add')}</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!loading && list.length === 0 && <EmptyState title={t('ไม่พบสินค้า', 'No products found')} body={t('ลองค้นหาด้วยคำอื่น หรือขอใบเสนอราคาสำหรับสินค้าที่ต้องการ', 'Try another search or request a quotation for what you need.')} action={<LinkButton href="/quote/" variant="outline">{t('ขอใบเสนอราคา', 'Request a quote')}</LinkButton>} />}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? name(open) : ''} wide>
        {open && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl"><PhotoSlot src={open.image_url} alt={name(open)} label={name(open)} icon={Package} /></div>
            <div className="space-y-4">
              <p className="text-neutral-700">{lang === 'th' ? open.desc_th : open.desc_en}</p>
              <dl className="divide-y rounded-xl border text-sm">
                <div className="flex justify-between gap-3 p-3"><dt className="text-neutral-500">{t('สเปก', 'Specification')}</dt><dd className="text-right font-medium">{open.spec || '—'}</dd></div>
                <div className="flex justify-between gap-3 p-3"><dt className="text-neutral-500">{t('หน่วย', 'Unit')}</dt><dd className="font-medium">{unit(open)}</dd></div>
                <div className="flex justify-between gap-3 p-3"><dt className="text-neutral-500">{t('ราคา', 'Price')}</dt><dd className="font-medium">{open.price != null ? formatTHB(open.price, lang) : t('ขอใบเสนอราคา', 'Request quotation')}</dd></div>
                <div className="flex justify-between gap-3 p-3"><dt className="text-neutral-500">{t('จำนวนคงเหลือ', 'Available')}</dt><dd className="font-medium">{open.stock != null ? `${open.stock} ${unit(open)}` : t('สอบถามเจ้าหน้าที่', 'Ask our team')}</dd></div>
                <div className="flex justify-between gap-3 p-3"><dt className="text-neutral-500">{t('การจัดส่ง', 'Delivery')}</dt><dd><DeliveryIcons p={open} /></dd></div>
              </dl>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" htmlFor="qty">{t('จำนวน', 'Qty')}</label>
                <Input id="qty" type="number" min={1} step="0.5" className="w-28" value={qty} onChange={(e) => setQty(Math.max(0.5, Number(e.target.value) || 1))} />
                <span className="text-sm text-neutral-500">{unit(open)}</span>
              </div>
              <Button size="lg" className="w-full" onClick={() => { add(open, qty); setOpen(null); }}><ShoppingCart className="h-5 w-5" />{t('เพิ่มลงตะกร้า', 'Add to cart')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
