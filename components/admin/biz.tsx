'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, quotationTotal } from '@/lib/data';
import {
  CONSTRUCTION_SERVICE, CONSTRUCTION_STATUS, MACHINERY_STATUS, MACHINERY_TYPE, ORDER_STATUS, PAYMENT_STATUS, QUOTATION_STATUS, TRANSPORT_MODE,
} from '@/lib/labels';
import type {
  ConstructionRequest, ConstructionStatus, ContactInfo, Machinery, MachineryBooking, MachineryBookingStatus, Order, OrderStatus,
  Product, ProductCategory, QuotationKind, Settings, Store, TransportMode, ConstructionService,
} from '@/lib/types';
import { downloadFile, formatDate, formatTHB, toCSV, uid } from '@/lib/utils';
import { Alert, Badge, Button, Checkbox, DemoTag, Field, Input, Modal, Select, StatusBadge, Tabs, Textarea, PhotoSlot } from '@/components/ui';
import { downloadQuotation } from '@/app/account/view';
import { DataTable, ImageUploadButton, QuotationBuilder, RecordModal, useAction, useActor, useDanger, type FieldDef } from './kit';

function QuoteButton({ kind, target, phone, s }: { kind: QuotationKind; target: string; phone: string; s: Store }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}><FileText className="h-4 w-4" />{t('สร้างใบเสนอราคา', 'Create quotation')}</Button>
    <QuotationBuilder open={open} onClose={() => setOpen(false)} kind={kind} targetRef={target} phone={phone} defaultDeposit={s.settings.deposit_percent} /></>;
}
const contactLine = (c: ContactInfo) => `${c.full_name}${c.company_name ? ` (${c.company_name})` : ''} · ${c.phone}${c.line_id ? ` · LINE ${c.line_id}` : ''}${c.email ? ` · ${c.email}` : ''}`;

export function ConstructionAdmin({ s }: { s: Store }) {
  const { t, lang, pick } = useLang();
  const [openId, setOpenId] = useState<string | null>(null);
  const c = s.construction.find((x) => x.id === openId);
  return (
    <>
      <DataTable rows={s.construction} onRow={(r) => setOpenId(r.id)} empty={t('ยังไม่มีคำขอ', 'No requests')} cols={[
        { label: t('เลขอ้างอิง', 'Ref'), render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
        { label: t('ประเภท', 'Type'), render: (r) => pick(CONSTRUCTION_SERVICE[r.project_type]) },
        { label: t('สถานที่', 'Location'), render: (r) => r.location },
        { label: t('ลูกค้า', 'Customer'), render: (r) => <>{r.contact.full_name}<span className="block text-xs text-neutral-500">{r.contact.phone}</span></> },
        { label: t('ผู้รับผิดชอบ', 'Assigned'), render: (r) => r.assigned_to || '—' },
        { label: t('สถานะ', 'Status'), render: (r) => <div className="flex gap-1"><StatusBadge status={r.status} />{r.is_demo && <DemoTag />}</div> },
      ]} />
      {c && <ConstructionModal c={c} s={s} onClose={() => setOpenId(null)} lang={lang} />}
    </>
  );
}
function ConstructionModal({ c, s, onClose }: { c: ConstructionRequest; s: Store; onClose: () => void; lang: string }) {
  const { t, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const danger = useDanger();
  const [f, setF] = useState({ assigned_to: c.assigned_to || '', inspection_date: c.inspection_date || '', progress: c.progress });
  const [status, setStatus] = useState<ConstructionStatus>(c.status);
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={c.ref} wide>
      <div className="space-y-4 text-sm">
        <p><strong>{pick(CONSTRUCTION_SERVICE[c.project_type])}</strong> · {c.location}</p>
        <p className="text-neutral-700">{c.description}</p>
        <dl className="grid gap-2 sm:grid-cols-3">
          {[[t('ขนาดโครงการ', 'Size'), c.project_size], [t('ที่ดิน', 'Land'), c.land_size], [t('งบประมาณ', 'Budget'), c.budget], [t('เริ่ม', 'Start'), c.start_date], [t('เสร็จ', 'Finish'), c.end_date], [t('ไฟล์', 'Files'), c.files.length ? c.files.map((x) => x.split('/').pop()).join(', ') : '—']].map(([k, v]) => <div key={k}><dt className="text-neutral-500">{k}</dt><dd className="font-medium">{v || '—'}</dd></div>)}
        </dl>
        <p>{contactLine(c.contact)}</p>
        <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
          <Field label={t('มอบหมายพนักงาน', 'Assign employee')}><Input value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} /></Field>
          <Field label={t('วันนัดสำรวจหน้างาน', 'Site inspection')}><Input type="date" value={f.inspection_date} onChange={(e) => setF({ ...f, inspection_date: e.target.value })} /></Field>
          <Field label={`${t('ความคืบหน้า', 'Progress')} ${f.progress}%`}><input type="range" min={0} max={100} step={5} value={f.progress} onChange={(e) => setF({ ...f, progress: Number(e.target.value) })} className="mt-3 w-full accent-[#C00000]" /></Field>
          <Field label={t('สถานะ', 'Status')}><Select value={status} onChange={(e) => setStatus(e.target.value as ConstructionStatus)}>{(Object.keys(CONSTRUCTION_STATUS) as ConstructionStatus[]).map((k) => <option key={k} value={k}>{pick(CONSTRUCTION_STATUS[k])}</option>)}</Select></Field>
          <Field label={t('หมายเหตุ', 'Note')} className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button onClick={() => act(() => api.updateConstruction(c.id, { ...f, inspection_date: f.inspection_date || undefined }, status !== c.status ? status : (f.inspection_date && !c.inspection_date ? 'inspection_scheduled' : null), note, actor), t('บันทึกแล้ว', 'Saved'))}>{t('บันทึก', 'Save')}</Button>
            <QuoteButton kind="construction" target={c.ref} phone={c.contact.phone} s={s} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MachineryAdmin({ s }: { s: Store }) {
  const { t, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const danger = useDanger();
  const [tab, setTab] = useState<'bookings' | 'fleet'>('bookings');
  const [edit, setEdit] = useState<Machinery | null>(null);
  const [open, setOpen] = useState<MachineryBooking | null>(null);
  const [assign, setAssign] = useState('');
  const [status, setStatus] = useState<MachineryBookingStatus>('confirmed');
  const fields: FieldDef<Machinery>[] = [
    { key: 'name', label: t('ชื่อ/รหัสเครื่อง', 'Name / ID'), required: true },
    { key: 'machinery_type', label: t('ประเภท', 'Type'), type: 'select', options: Object.entries(MACHINERY_TYPE).map(([k, v]) => ({ value: k, label: pick(v) })) },
    { key: 'capacity', label: t('ขนาด/ความสามารถ', 'Capacity') },
    { key: 'status', label: t('สถานะ', 'Availability'), type: 'select', options: [{ value: 'available', label: t('พร้อมใช้งาน', 'Available') }, { value: 'maintenance', label: t('ซ่อมบำรุง', 'Maintenance') }, { value: 'inactive', label: t('ไม่ใช้งาน', 'Inactive') }] },
    { key: 'rate_hour', label: t('ค่าเช่า/ชม. (ถ้ามี)', 'Hourly rate (optional)'), type: 'nullable-number' },
    { key: 'rate_day', label: t('ค่าเช่า/วัน (ถ้ามี)', 'Daily rate (optional)'), type: 'nullable-number' },
  ];
  const cur = open ? s.machineryBookings.find((x) => x.id === open.id) : null;
  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} items={[{ value: 'bookings', label: t('การจองเช่า', 'Reservations'), count: s.machineryBookings.length }, { value: 'fleet', label: t('รายการเครื่องจักร', 'Machinery inventory'), count: s.machinery.length }]} />
      {tab === 'bookings' && <DataTable rows={s.machineryBookings} onRow={(r) => { setOpen(r); setAssign(r.machinery_id || ''); setStatus(r.status === 'pending_review' ? 'confirmed' : r.status); }} empty={t('ยังไม่มีการจอง', 'No reservations')} cols={[
        { label: t('เลขอ้างอิง', 'Ref'), render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
        { label: t('ประเภท', 'Type'), render: (r) => pick(MACHINERY_TYPE[r.machinery_type]) },
        { label: t('ช่วงเวลา', 'When'), render: (r) => <span className="whitespace-nowrap">{r.start_date} · {r.duration} {r.rate_unit === 'day' ? t('วัน', 'd') : t('ชม.', 'h')}</span> },
        { label: t('เครื่องที่จัดให้', 'Assigned'), render: (r) => s.machinery.find((m) => m.id === r.machinery_id)?.name || '—' },
        { label: t('สถานะ', 'Status'), render: (r) => <div className="flex gap-1"><StatusBadge status={r.status} />{r.is_demo && <DemoTag />}</div> },
      ]} />}
      {tab === 'fleet' && <>
        <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ id: uid(), machinery_type: 'dump_truck', name: '', capacity: '', status: 'available', rate_hour: null, rate_day: null })}><Plus className="h-4 w-4" />{t('เพิ่มเครื่องจักร', 'Add machine')}</Button></div>
        <DataTable rows={s.machinery} onRow={setEdit} empty="—" cols={[
          { label: t('ชื่อ', 'Name'), render: (m) => <span className="font-semibold">{m.name}</span> },
          { label: t('ประเภท', 'Type'), render: (m) => pick(MACHINERY_TYPE[m.machinery_type]) },
          { label: t('ขนาด', 'Capacity'), render: (m) => m.capacity },
          { label: t('สถานะ', 'Status'), render: (m) => <div className="flex gap-1"><Badge tone={m.status === 'available' ? 'ok' : 'warn'}>{m.status}</Badge>{m.is_demo && <DemoTag />}</div> },
          { label: '', render: (m) => <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); danger(t('ลบรายการนี้?', 'Delete this item?'), () => api.remove('machinery', m.id), t('ลบแล้ว', 'Deleted')); }}><Trash2 className="h-4 w-4" /></Button> },
        ]} />
      </>}
      <RecordModal open={!!edit} title={t('เครื่องจักร', 'Machine')} initial={edit} fields={fields} onClose={() => setEdit(null)} onSave={(r) => act(() => api.upsert('machinery', r), t('บันทึกแล้ว', 'Saved'))} />
      {cur && (
        <Modal open onClose={() => setOpen(null)} title={cur.ref}>
          <div className="space-y-4 text-sm">
            <p><strong>{pick(MACHINERY_TYPE[cur.machinery_type])}</strong> {cur.capacity && `· ${cur.capacity}`} · {cur.location}</p>
            <p>{cur.start_date} · {cur.duration} {cur.rate_unit === 'day' ? t('วัน', 'days') : t('ชั่วโมง', 'hours')} · {cur.operator ? t('ต้องการคนขับ', 'with operator') : t('ไม่ต้องการคนขับ', 'no operator')}</p>
            <p className="text-neutral-700">{cur.description}</p>
            <p>{contactLine(cur.contact)}</p>
            <Field label={t('จัดเครื่องจักร', 'Assign machine')}><Select value={assign} onChange={(e) => setAssign(e.target.value)}><option value="">—</option>{s.machinery.filter((m) => m.machinery_type === cur.machinery_type || cur.machinery_type === 'heavy').map((m) => <option key={m.id} value={m.id} disabled={m.status !== 'available'}>{m.name} ({m.status})</option>)}</Select></Field>
            <Field label={t('สถานะ', 'Status')}><Select value={status} onChange={(e) => setStatus(e.target.value as MachineryBookingStatus)}>{(Object.keys(MACHINERY_STATUS) as MachineryBookingStatus[]).map((k) => <option key={k} value={k}>{pick(MACHINERY_STATUS[k])}</option>)}</Select></Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act(() => api.setMachineryStatus(cur.id, status, assign || null, '', actor), t('บันทึกแล้ว (ตรวจการจองซ้อนแล้ว)', 'Saved (overlap checked)'))}>{t('บันทึก', 'Save')}</Button>
              <QuoteButton kind="machinery" target={cur.ref} phone={cur.contact.phone} s={s} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function OrdersAdmin({ s }: { s: Store }) {
  const { t, lang, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const danger = useDanger();
  const [open, setOpen] = useState<Order | null>(null);
  const cur = open ? s.orders.find((o) => o.id === open.id) : null;
  return (
    <>
      <DataTable rows={s.orders} onRow={setOpen} empty={t('ยังไม่มีคำสั่งซื้อ', 'No orders yet')} cols={[
        { label: t('เลขอ้างอิง', 'Ref'), render: (o) => <span className="font-mono font-semibold">{o.ref}</span> },
        { label: t('ลูกค้า', 'Customer'), render: (o) => <>{o.contact.full_name}{o.contact.type === 'company' && <Badge className="ml-1">B2B</Badge>}<span className="block text-xs text-neutral-500">{o.contact.phone}</span></> },
        { label: t('รายการ', 'Items'), render: (o) => o.items.map((i) => `${i.name}×${i.qty}`).join(', ') },
        { label: t('ยอด', 'Total'), className: 'text-right', render: (o) => <span className="whitespace-nowrap">{o.subtotal != null ? formatTHB(o.subtotal, lang) : '—'}</span> },
        { label: t('สถานะ', 'Status'), render: (o) => <StatusBadge status={o.status} /> },
      ]} />
      {cur && (
        <Modal open onClose={() => setOpen(null)} title={cur.ref} wide>
          <div className="space-y-4 text-sm">
            <ul className="rounded-xl bg-neutral-50 p-3">{cur.items.map((i, n) => <li key={n}>• {i.name} — {i.qty} {i.unit}{i.unit_price != null ? ` × ${formatTHB(i.unit_price, lang)}` : ''}</li>)}</ul>
            <p>{t('จัดส่งที่', 'Deliver to')}: {cur.delivery_location}{cur.with_transport && ` · ${t('ต้องการขนส่ง', 'transport requested')}`}{cur.route_id && ` · ${s.routes.find((r) => r.id === cur.route_id)?.name_th}`}</p>
            {cur.notes && <p className="text-neutral-600">{cur.notes}</p>}
            <p>{contactLine(cur.contact)}{cur.contact.tax_id && ` · Tax ${cur.contact.tax_id}`}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('สถานะ', 'Status')}><Select defaultValue={cur.status} onChange={(e) => act(() => api.setOrderStatus(cur.id, e.target.value as OrderStatus, '', actor), t('อัปเดตแล้ว', 'Updated'))}>{(Object.keys(ORDER_STATUS) as OrderStatus[]).map((k) => <option key={k} value={k}>{pick(ORDER_STATUS[k])}</option>)}</Select></Field>
              <QuoteButton kind="order" target={cur.ref} phone={cur.contact.phone} s={s} />
            </div>
            <p className="text-xs text-neutral-500">{t('เมื่อยืนยันคำสั่งซื้อ ระบบจะตัดสต็อกสินค้าที่ติดตามจำนวนไว้', 'Confirming an order deducts tracked stock.')}</p>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ProductsAdmin({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const act = useAction();
  const danger = useDanger();
  const [edit, setEdit] = useState<Product | null>(null);
  const [editCat, setEditCat] = useState<ProductCategory | null>(null);
  const catOpts = s.categories.map((c) => ({ value: c.id, label: lang === 'th' ? c.name_th : c.name_en }));
  const fields: FieldDef<Product>[] = [
    { key: 'name_th', label: 'ชื่อสินค้า (ไทย)', required: true }, { key: 'name_en', label: 'Product name (EN)', required: true },
    { key: 'category_id', label: t('หมวดหมู่', 'Category'), type: 'select', options: catOpts },
    { key: 'spec', label: t('สเปก', 'Specification') },
    { key: 'unit_th', label: 'หน่วย (ไทย)', required: true }, { key: 'unit_en', label: 'Unit (EN)', required: true },
    { key: 'price', label: t('ราคา/หน่วย (บาท)', 'Price per unit (THB)'), type: 'nullable-number', hint: t('ว่าง = แสดง “ขอใบเสนอราคา”', 'blank = “request quotation”') },
    { key: 'stock', label: t('จำนวนคงเหลือ', 'Stock on hand'), type: 'nullable-number', hint: t('ว่าง = ไม่ติดตามสต็อก', 'blank = not tracked') },
    { key: 'desc_th', label: 'รายละเอียด (ไทย)', type: 'textarea' }, { key: 'desc_en', label: 'Description (EN)', type: 'textarea' },
    { key: 'image_url', label: t('URL รูปสินค้า', 'Image URL'), full: true },
    { key: 'active', label: t('แสดงในร้านค้า', 'Visible in store'), type: 'checkbox' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditCat({ id: uid(), slug: '', name_th: '', name_en: '', sort: s.categories.length })}><Plus className="h-4 w-4" />{t('หมวดหมู่', 'Category')}</Button>
        <Button size="sm" onClick={() => setEdit({ id: uid(), category_id: s.categories[0]?.id || '', name_th: '', name_en: '', desc_th: '', desc_en: '', spec: '', unit_th: '', unit_en: '', price: null, stock: null, delivery: ['pickup', 'truck', 'ship'], active: true })}><Plus className="h-4 w-4" />{t('เพิ่มสินค้า', 'Add product')}</Button>
      </div>
      <div className="flex flex-wrap gap-2">{s.categories.map((c) => <button key={c.id} onClick={() => setEditCat(c)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200">{lang === 'th' ? c.name_th : c.name_en} <Pencil className="inline h-3 w-3" /></button>)}</div>
      <DataTable rows={s.products} onRow={setEdit} empty="—" cols={[
        { label: '', render: (p) => <div className="h-12 w-12 overflow-hidden rounded-lg"><PhotoSlot src={p.image_url} alt={p.name_th} /></div> },
        { label: t('สินค้า', 'Product'), render: (p) => <><span className="font-semibold">{lang === 'th' ? p.name_th : p.name_en}</span><span className="block text-xs text-neutral-500">{catOpts.find((c) => c.value === p.category_id)?.label}</span></> },
        { label: t('ราคา', 'Price'), className: 'text-right', render: (p) => <span className="whitespace-nowrap">{p.price != null ? `${formatTHB(p.price, lang)}/${p.unit_th}` : <span className="text-neutral-500">{t('ขอใบเสนอราคา', 'quote')}</span>}</span> },
        { label: t('สต็อก', 'Stock'), className: 'text-right', render: (p) => (p.stock != null ? p.stock : '—') },
        { label: t('สถานะ', 'Status'), render: (p) => <div className="flex gap-1"><Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? t('แสดง', 'Live') : t('ซ่อน', 'Hidden')}</Badge>{p.is_demo && <DemoTag />}</div> },
        { label: '', render: (p) => <div className="flex gap-1" onClick={(e) => e.stopPropagation()}><ImageUploadButton folder="products" onUrl={(url) => act(() => api.upsert('products', { ...p, image_url: url }), t('อัปโหลดแล้ว', 'Uploaded'))} /><Button size="sm" variant="danger" onClick={() => danger(t('ลบรายการนี้?', 'Delete this item?'), () => api.remove('products', p.id), t('ลบแล้ว', 'Deleted'))}><Trash2 className="h-4 w-4" /></Button></div> },
      ]} />
      <RecordModal open={!!edit} title={t('สินค้า', 'Product')} initial={edit} fields={fields} onClose={() => setEdit(null)} onSave={(r) => act(() => api.upsert('products', r), t('บันทึกแล้ว', 'Saved'))} />
      <RecordModal open={!!editCat} title={t('หมวดหมู่', 'Category')} initial={editCat} onClose={() => setEditCat(null)} onSave={(r) => act(() => api.upsert('categories', { ...r, slug: r.slug || r.name_en.toLowerCase().replace(/\W+/g, '-') }), t('บันทึกแล้ว', 'Saved'))}
        fields={[{ key: 'name_th', label: 'ชื่อ (ไทย)', required: true }, { key: 'name_en', label: 'Name (EN)', required: true }, { key: 'sort', label: t('ลำดับ', 'Sort'), type: 'number' }]} />
    </div>
  );
}

export function CustomersAdmin({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const [onlyB2B, setOnlyB2B] = useState(false);
  const customers = useMemo(() => {
    const m = new Map<string, { phone: string; name: string; company?: string; type: string; email?: string; count: number; last: string; refs: string[] }>();
    const add = (c: ContactInfo, ref: string, at: string) => {
      const x = m.get(c.phone) || { phone: c.phone, name: c.full_name, company: c.company_name, type: c.type, email: c.email, count: 0, last: at, refs: [] };
      x.count++; x.refs.push(ref); if (at > x.last) x.last = at; if (c.type === 'company') { x.type = 'company'; x.company = c.company_name || x.company; }
      m.set(c.phone, x);
    };
    s.cargo.forEach((b) => add(b.contact, b.ref, b.created_at)); s.construction.forEach((b) => add(b.contact, b.ref, b.created_at));
    s.machineryBookings.forEach((b) => add(b.contact, b.ref, b.created_at)); s.orders.forEach((b) => add(b.contact, b.ref, b.created_at));
    s.users.filter((u) => u.role === 'customer').forEach((u) => { if (!m.has(u.phone)) m.set(u.phone, { phone: u.phone, name: u.full_name, company: u.company_name, type: u.account_type, email: u.email, count: 0, last: '', refs: [] }); });
    return Array.from(m.values()).filter((c) => (!onlyB2B || c.type === 'company') && (!q || `${c.name} ${c.phone} ${c.company || ''}`.toLowerCase().includes(q.toLowerCase())));
  }, [s, q, onlyB2B]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4"><Input className="max-w-xs" placeholder={t('ค้นหาชื่อ เบอร์ บริษัท', 'Search name, phone, company')} value={q} onChange={(e) => setQ(e.target.value)} /><Checkbox checked={onlyB2B} onChange={setOnlyB2B}>{t('เฉพาะลูกค้าธุรกิจ', 'Business customers only')}</Checkbox></div>
      <DataTable rows={customers} empty={t('ยังไม่มีลูกค้า', 'No customers')} cols={[
        { label: t('ลูกค้า', 'Customer'), render: (c) => <><span className="font-semibold">{c.name}</span>{c.type === 'company' && <Badge className="ml-1">B2B</Badge>}{c.company && <span className="block text-xs text-neutral-500">{c.company}</span>}</> },
        { label: t('ติดต่อ', 'Contact'), render: (c) => <>{c.phone}<span className="block text-xs text-neutral-500">{c.email}</span></> },
        { label: t('จำนวนรายการ', 'Records'), className: 'text-right', render: (c) => c.count },
        { label: t('ประวัติ', 'History'), render: (c) => <span className="font-mono text-xs">{c.refs.slice(0, 3).join(', ')}{c.refs.length > 3 && '…'}</span> },
        { label: t('ล่าสุด', 'Last'), render: (c) => (c.last ? formatDate(c.last, lang) : '—') },
      ]} />
    </div>
  );
}

export function FinanceAdmin({ s }: { s: Store }) {
  const { t, lang, pick } = useLang();
  const actor = useActor();
  const act = useAction();
  const danger = useDanger();
  const [tab, setTab] = useState<'payments' | 'quotations' | 'balances'>('payments');
  const [note, setNote] = useState('');
  const balances = s.quotations.filter((q) => q.status === 'accepted').map((q) => {
    const paid = s.payments.filter((p) => p.target_ref === q.target_ref && p.status === 'verified').reduce((x, p) => x + p.amount, 0);
    const { total } = quotationTotal(q);
    return { q, total, paid, due: Math.max(0, total - paid) };
  });
  const exp = (name: string, rows: Record<string, unknown>[]) => downloadFile(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'payments', label: t('ตรวจสลิป', 'Verify slips'), count: s.payments.filter((p) => p.status === 'pending').length },
        { value: 'quotations', label: t('ใบเสนอราคา', 'Quotations'), count: s.quotations.length },
        { value: 'balances', label: t('มัดจำ/ยอดค้าง', 'Deposits & balances') },
      ]} />
      {tab === 'payments' && <>
        <Field label={t('หมายเหตุการตรวจสอบ (ส่งถึงลูกค้า)', 'Verification note (sent to customer)')} className="max-w-md"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <DataTable rows={s.payments} empty={t('ยังไม่มีการแจ้งชำระ', 'No payments submitted')} cols={[
          { label: t('เลขที่', 'Ref'), render: (p) => <span className="font-mono">{p.ref}</span> },
          { label: t('สำหรับ', 'For'), render: (p) => <span className="font-mono text-xs">{p.target_ref}</span> },
          { label: t('จำนวน', 'Amount'), className: 'text-right', render: (p) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatTHB(p.amount, lang)}</span> },
          { label: t('ประเภท', 'Type'), render: (p) => `${p.payment_type} · ${p.method}` },
          { label: t('สลิป', 'Slip'), render: (p) => <span className="text-xs">{p.slip_name.split('/').pop()}</span> },
          { label: t('สถานะ', 'Status'), render: (p) => <StatusBadge status={p.status} /> },
          { label: '', render: (p) => p.status === 'pending' && <div className="flex gap-1">
            <Button size="sm" onClick={() => act(() => api.verifyPayment(p.id, true, note, actor), t('ยืนยันการชำระแล้ว', 'Payment verified'))}><CheckCircle2 className="h-4 w-4" />{t('ยืนยัน', 'Verify')}</Button>
            <Button size="sm" variant="danger" onClick={() => danger(t('ปฏิเสธสลิปนี้?', 'Reject this slip?'), () => api.verifyPayment(p.id, false, note, actor), t('ปฏิเสธสลิปแล้ว', 'Slip rejected'))}><XCircle className="h-4 w-4" /></Button></div> },
        ]} />
        <p className="text-xs text-neutral-500">{t('ระบบไม่ยืนยันการชำระเงินอัตโนมัติ เจ้าหน้าที่ต้องตรวจสอบยอดเงินเข้าบัญชีจริงก่อนกดยืนยันทุกครั้ง', 'Payments are never auto-confirmed — check the bank statement before verifying.')}</p>
      </>}
      {tab === 'quotations' && <DataTable rows={s.quotations} empty={t('ยังไม่มีใบเสนอราคา', 'No quotations')} cols={[
        { label: t('เลขที่', 'Ref'), render: (q) => <span className="font-mono">{q.ref}</span> },
        { label: t('สำหรับ', 'For'), render: (q) => <><span className="font-mono text-xs">{q.target_ref}</span><span className="block text-xs text-neutral-500">{q.kind}</span></> },
        { label: t('ยอดรวม', 'Total'), className: 'text-right', render: (q) => <span className="whitespace-nowrap tabular-nums">{formatTHB(quotationTotal(q).total, lang)}</span> },
        { label: t('สถานะ', 'Status'), render: (q) => <Badge tone={q.status === 'accepted' ? 'ok' : q.status === 'rejected' ? 'bad' : 'warn'}>{pick(QUOTATION_STATUS[q.status])}</Badge> },
        { label: '', render: (q) => <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => downloadQuotation(q, lang as 'th' | 'en')}><Download className="h-4 w-4" /></Button>{q.status === 'accepted' && <Button size="sm" variant="ghost" onClick={() => downloadQuotation(q, lang as 'th' | 'en', true)}>{t('ใบแจ้งหนี้', 'Invoice')}</Button>}</div> },
      ]} />}
      {tab === 'balances' && <DataTable rows={balances} empty={t('ยังไม่มีใบเสนอราคาที่ยอมรับ', 'No accepted quotations')} cols={[
        { label: t('งาน', 'Job'), render: (b) => <span className="font-mono text-xs">{b.q.target_ref}</span> },
        { label: t('ยอดรวม', 'Total'), className: 'text-right', render: (b) => <span className="tabular-nums">{formatTHB(b.total, lang)}</span> },
        { label: t('มัดจำที่กำหนด', 'Deposit due'), className: 'text-right', render: (b) => (b.q.deposit_percent != null ? formatTHB(Math.round(b.total * b.q.deposit_percent) / 100, lang) : '—') },
        { label: t('ชำระแล้ว', 'Paid'), className: 'text-right', render: (b) => <span className="tabular-nums text-emerald-700">{formatTHB(b.paid, lang)}</span> },
        { label: t('คงค้าง', 'Balance'), className: 'text-right', render: (b) => <span className="font-semibold tabular-nums text-brand-red">{formatTHB(b.due, lang)}</span> },
      ]} />}
    </div>
  );
}

export function WebsiteAdmin({ s }: { s: Store }) {
  const { t, pick } = useLang();
  const act = useAction();
  const danger = useDanger();
  const [f, setF] = useState<Settings>(s.settings);
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const text = (k: keyof Settings, label: string, area = false) => <Field label={label} className={area ? 'sm:col-span-2' : ''}>{area ? <Textarea className="min-h-[70px]" value={String(f[k] ?? '')} onChange={set(k)} /> : <Input value={String(f[k] ?? '')} onChange={set(k)} />}</Field>;
  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); act(() => api.saveSettings(f), t('บันทึกการตั้งค่าแล้ว', 'Settings saved')); }}>
      <section className="rounded-2xl border bg-white p-5"><h3 className="mb-4 font-display text-lg font-bold">{t('ข้อมูลติดต่อ', 'Contact details')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">{text('phone', t('โทรศัพท์', 'Phone'))}{text('email', t('อีเมล', 'Email'))}{text('line_id', 'LINE ID')}{text('line_url', 'LINE URL (https://lin.ee/...)')}{text('address_th', 'ที่อยู่ (ไทย)', true)}{text('address_en', 'Address (EN)', true)}</div></section>
      <section className="rounded-2xl border bg-white p-5"><h3 className="mb-4 font-display text-lg font-bold">{t('บัญชีรับชำระเงิน', 'Payment accounts')}</h3>
        <Alert className="mb-4">{t('กรอกเฉพาะบัญชีจริงของบริษัทที่ตรวจสอบแล้ว ระบบจะไม่แสดงช่องทางชำระเงินจนกว่าจะกรอกข้อมูล', 'Enter only verified company accounts. Payment options stay hidden until filled.')}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">{text('bank_name', t('ธนาคาร', 'Bank'))}{text('bank_account_name', t('ชื่อบัญชี', 'Account name'))}{text('bank_account_no', t('เลขที่บัญชี', 'Account number'))}{text('promptpay_id', 'PromptPay ID')}
          <Field label={t('มัดจำเริ่มต้น %', 'Default deposit %')}><Input type="number" min={0} max={100} value={f.deposit_percent ?? ''} onChange={(e) => setF({ ...f, deposit_percent: e.target.value === '' ? null : Number(e.target.value) })} /></Field></div></section>
      <section className="rounded-2xl border bg-white p-5"><h3 className="mb-4 font-display text-lg font-bold">{t('หน้าแรกและประกาศ', 'Homepage & announcements')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">{text('announcement_th', 'ประกาศ (ไทย)')}{text('announcement_en', 'Announcement (EN)')}{text('hero_title_th', 'หัวข้อหลัก (ไทย)')}{text('hero_title_en', 'Headline (EN)')}{text('hero_sub_th', 'คำอธิบาย (ไทย)', true)}{text('hero_sub_en', 'Description (EN)', true)}
          <Field label={t('ขนาดหัวข้อหลัก', 'Headline size')}><select className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3" value={f.hero_title_size || 'xl'} onChange={(e) => setF({ ...f, hero_title_size: e.target.value as Settings['hero_title_size'] })}><option value="sm">{t('เล็ก', 'Small')}</option><option value="md">{t('กลาง', 'Medium')}</option><option value="lg">{t('ใหญ่', 'Large')}</option><option value="xl">{t('ใหญ่มาก', 'Extra large')}</option></select></Field>
          <Field label={t('สีหัวข้อหลัก', 'Headline colour')}><div className="flex flex-wrap items-center gap-2">{[['#FFD600', t('เหลือง', 'Yellow')], ['#FFFFFF', t('ขาว', 'White')], ['#FFB3B3', t('ชมพูอ่อน', 'Light pink')]].map(([c, n]) => <button key={c} type="button" onClick={() => setF({ ...f, hero_title_color: c })} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm ${(f.hero_title_color || '#FFD600').toLowerCase() === c.toLowerCase() ? 'border-brand-red ring-2 ring-brand-red/30' : 'border-neutral-300'}`}><span className="h-5 w-5 rounded-full border" style={{ background: c }} />{n}</button>)}<input type="color" aria-label="custom colour" className="h-11 w-12 cursor-pointer rounded-xl border border-neutral-300 bg-white p-1" value={f.hero_title_color || '#FFD600'} onChange={(e) => setF({ ...f, hero_title_color: e.target.value })} /></div></Field>
          <div className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">{t('ภาพแบนเนอร์หน้าแรก', 'Homepage banner image')}</span><div className="flex flex-wrap items-center gap-3">{f.hero_image_url && <img src={f.hero_image_url} alt="" className="h-16 rounded-lg" />}<ImageUploadButton folder="site" onUrl={(url) => setF({ ...f, hero_image_url: url })} />{f.hero_image_url && <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, hero_image_url: '' })}>{t('ใช้ภาพเริ่มต้น', 'Use default')}</Button>}</div></div></div></section>
      <section className="rounded-2xl border bg-white p-5"><h3 className="mb-2 font-display text-lg font-bold">{t('บริการที่เปิดให้บริการจริง', 'Services actually offered')}</h3>
        <p className="mb-4 text-sm text-neutral-500">{t('ลูกค้าจะเห็นเฉพาะตัวเลือกที่เปิดไว้', 'Customers only see enabled options')}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2"><p className="text-sm font-semibold">{t('รูปแบบการขนส่ง', 'Transport options')}</p>{(Object.keys(TRANSPORT_MODE) as TransportMode[]).map((k) => <Checkbox key={k} checked={f.transport_modes[k]} onChange={(v) => setF({ ...f, transport_modes: { ...f.transport_modes, [k]: v } })}>{pick(TRANSPORT_MODE[k])}</Checkbox>)}</div>
          <div className="space-y-2"><p className="text-sm font-semibold">{t('งานก่อสร้าง', 'Construction services')}</p>{(Object.keys(CONSTRUCTION_SERVICE) as ConstructionService[]).map((k) => <Checkbox key={k} checked={f.construction_services[k]} onChange={(v) => setF({ ...f, construction_services: { ...f.construction_services, [k]: v } })}>{pick(CONSTRUCTION_SERVICE[k])}</Checkbox>)}</div>
        </div></section>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg">{t('บันทึกการตั้งค่า', 'Save settings')}</Button>
        {api.mode === 'demo' && <Button type="button" variant="danger" onClick={() => act(() => api.resetDemo(), t('รีเซ็ตข้อมูลตัวอย่างแล้ว', 'Demo data reset'))}><RotateCcw className="h-4 w-4" />{t('รีเซ็ตข้อมูลตัวอย่าง', 'Reset demo data')}</Button>}
      </div>
      <p className="text-xs text-neutral-500">{t('สถานะการชำระเงินบนการจอง', 'Payment status labels')}: {Object.values(PAYMENT_STATUS).map((x) => pick(x)).join(' · ')}</p>
    </form>
  );
}
