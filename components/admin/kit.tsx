'use client';

// Shared admin building blocks: record forms, data tables, quotation builder.

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api, quotationTotal } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import type { QuotationItem, QuotationKind } from '@/lib/types';
import { BusinessError, ValidationError } from '@/lib/validation';
import { cn, formatTHB } from '@/lib/utils';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, useConfirm, useToast } from '@/components/ui';

export function isoToLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}
export function localToIso(v: string) {
  return v ? new Date(`${v}:00+07:00`).toISOString() : '';
}

/** Shrinks a photo to max 1600px JPEG before upload — phone photos (5–10MB) become ~200–400KB. */
export async function resizeImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch { return file; }
}

/** Image upload for admin media: compressed data URL in demo mode, public Storage URL in production. */
export async function uploadImage(file: File, folder: 'vessels' | 'products' | 'site'): Promise<string | null> {
  if (api.mode === 'demo') {
    const blob = await resizeImage(file, 1000, 0.72); // demo keeps photos in this browser only, so smaller
    if (blob.size > 400_000) return null;
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
  }
  const blob = await resizeImage(file);
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  const [url] = await api.uploadFiles([new File([blob], name, { type: 'image/jpeg' })], folder);
  return url;
}

export function ImageUploadButton({ folder, onUrl, multiple = false, label }: { folder: 'vessels' | 'products' | 'site'; onUrl: (url: string) => unknown; multiple?: boolean; label?: string }) {
  const { t } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <label className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold hover:border-brand-red', busy && 'pointer-events-none opacity-60')}>
      {busy ? t('กำลังอัปโหลด…', 'Uploading…') : label || t('อัปโหลดรูป', 'Upload photo')}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple={multiple} className="sr-only" onChange={async (e) => {
        const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
        setBusy(true);
        let failed = 0;
        for (const f of files) {
          const url = await uploadImage(f, folder).catch(() => null);
          if (url) await onUrl(url); else failed++;
        }
        setBusy(false);
        if (failed) toast(t(`อัปโหลดไม่สำเร็จ ${failed} รูป`, `${failed} photo(s) failed to upload`), 'bad');
      }} />
    </label>
  );
}

/** Asks “are you sure?” before a destructive action, then runs it with toast feedback. */
export function useDanger() {
  const confirm = useConfirm();
  const act = useAction();
  const { t } = useLang();
  return async (title: string, fn: () => Promise<unknown>, ok?: string) => {
    if (await confirm({ title, body: t('การกระทำนี้ย้อนกลับไม่ได้', 'This cannot be undone.'), confirm: t('ยืนยัน', 'Confirm'), danger: true })) return act(fn, ok);
    return false;
  };
}

export function useActor() {
  const { user } = useAuth();
  return user?.full_name || 'admin';
}

/** Wraps an admin action with toast feedback for business-rule errors. */
export function useAction() {
  const toast = useToast();
  const { lang } = useLang();
  return async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast(ok); return true; }
    catch (e) {
      if (e instanceof BusinessError) toast(lang === 'th' ? e.th : e.en, 'bad');
      else if (e instanceof ValidationError) toast(lang === 'th' ? 'ข้อมูลไม่ครบถ้วน' : 'Please complete the required fields', 'bad');
      else toast(lang === 'th' ? 'ดำเนินการไม่สำเร็จ' : 'Action failed', 'bad');
      return false;
    }
  };
}

export type FieldDef<T> = {
  key: keyof T & string; label: string; type?: 'text' | 'number' | 'select' | 'datetime' | 'checkbox' | 'textarea' | 'nullable-number';
  options?: { value: string; label: string }[]; required?: boolean; hint?: string; full?: boolean;
};

export function RecordModal<T extends { id: string }>({ open, title, initial, fields, onClose, onSave }: {
  open: boolean; title: string; initial: T | null; fields: FieldDef<T>[]; onClose: () => void; onSave: (r: T) => Promise<boolean>;
}) {
  const { t } = useLang();
  const [rec, setRec] = useState<T | null>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRec(initial), [initial]);
  if (!open || !rec) return null;
  const set = (k: string, v: unknown) => setRec({ ...rec, [k]: v } as T);
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const ok = await onSave(rec); setBusy(false); if (ok) onClose(); }}>
        {fields.map((f) => {
          const v = (rec as Record<string, unknown>)[f.key];
          const cls = f.full || f.type === 'textarea' ? 'sm:col-span-2' : '';
          if (f.type === 'checkbox') return <Checkbox key={f.key} className={cls} checked={!!v} onChange={(x) => set(f.key, x)}>{f.label}</Checkbox>;
          return (
            <Field key={f.key} label={f.label} required={f.required} hint={f.hint} className={cls}>
              {f.type === 'select' ? <Select value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} required={f.required}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                : f.type === 'textarea' ? <Textarea value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} />
                : f.type === 'datetime' ? <Input type="datetime-local" value={isoToLocal(v as string)} onChange={(e) => set(f.key, localToIso(e.target.value))} required={f.required} />
                : f.type === 'number' ? <Input type="number" step="any" value={v == null ? '' : String(v)} onChange={(e) => set(f.key, Number(e.target.value))} required={f.required} />
                : f.type === 'nullable-number' ? <Input type="number" step="any" placeholder={t('ว่าง = ให้เจ้าหน้าที่เสนอราคา', 'blank = quote manually')} value={v == null ? '' : String(v)} onChange={(e) => set(f.key, e.target.value === '' ? null : Number(e.target.value))} />
                : <Input value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} required={f.required} />}
            </Field>
          );
        })}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('ยกเลิก', 'Cancel')}</Button>
          <Button type="submit" loading={busy}>{t('บันทึก', 'Save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function DataTable<T>({ rows, cols, onRow, empty }: { rows: T[]; cols: { label: string; render: (r: T) => React.ReactNode; className?: string }[]; onRow?: (r: T) => void; empty: string }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-neutral-500">{empty}</div>;
  return (
    <div className="scroll overflow-x-auto rounded-2xl border bg-white">
      <table className="stack w-full text-sm">
        <thead><tr className="border-b bg-neutral-50 text-left text-neutral-500">{cols.map((c) => <th key={c.label} className={cn('whitespace-nowrap p-3 font-medium', c.className)}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={cn('border-b border-neutral-100 last:border-0', onRow && 'cursor-pointer hover:bg-red-50/40')}>
              {cols.map((c) => <td key={c.label} className={cn('p-3 align-top', c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuotationBuilder({ open, onClose, kind, targetRef, phone, defaultDeposit }: { open: boolean; onClose: () => void; kind: QuotationKind; targetRef: string; phone: string; defaultDeposit: number | null }) {
  const { t, lang } = useLang();
  const actor = useActor();
  const act = useAction();
  const [items, setItems] = useState<QuotationItem[]>([{ description: '', qty: 1, unit: '', unit_price: 0 }]);
  const [vat, setVat] = useState(7);
  const [deposit, setDeposit] = useState<string>(defaultDeposit != null ? String(defaultDeposit) : '');
  const [valid, setValid] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const totals = quotationTotal({ items, vat_rate: vat });
  const setItem = (i: number, p: Partial<QuotationItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <Modal open={open} onClose={onClose} title={`${t('สร้างใบเสนอราคา', 'Create quotation')} · ${targetRef}`} wide>
      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-neutral-50 p-3 sm:grid-cols-[2fr_80px_90px_130px_auto]">
            <Input placeholder={t('รายการ', 'Description')} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} className="col-span-2 sm:col-span-1" />
            <Input type="number" min={0} step="any" aria-label={t('จำนวน', 'Qty')} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
            <Input placeholder={t('หน่วย', 'Unit')} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
            <Input type="number" min={0} step="any" aria-label={t('ราคา/หน่วย', 'Unit price')} value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} />
            <Button variant="ghost" size="sm" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label={t('ลบ', 'Remove')}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems((x) => [...x, { description: '', qty: 1, unit: '', unit_price: 0 }])}><Plus className="h-4 w-4" />{t('เพิ่มรายการ', 'Add line')}</Button>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="VAT %"><Input type="number" min={0} max={100} value={vat} onChange={(e) => setVat(Number(e.target.value))} /></Field>
          <Field label={t('มัดจำ %', 'Deposit %')}><Input type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder={t('ไม่มี', 'none')} /></Field>
          <Field label={t('ยืนราคาถึง', 'Valid until')}><Input type="date" value={valid} onChange={(e) => setValid(e.target.value)} /></Field>
        </div>
        <Field label={t('หมายเหตุ', 'Notes')}><Textarea className="min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="rounded-xl bg-brand-grey p-4 text-sm tabular-nums">
          <div className="flex justify-between"><span>{t('รวมก่อนภาษี', 'Subtotal')}</span><span>{formatTHB(totals.sub, lang)}</span></div>
          <div className="flex justify-between"><span>VAT {vat}%</span><span>{formatTHB(totals.vat, lang)}</span></div>
          <div className="mt-1 flex justify-between font-display text-lg font-bold"><span>{t('รวมทั้งสิ้น', 'Total')}</span><span className="text-brand-red">{formatTHB(totals.total, lang)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('ยกเลิก', 'Cancel')}</Button>
          <Button loading={busy} onClick={async () => {
            setBusy(true);
            const ok = await act(() => api.createQuotation({ kind, target_ref: targetRef, customer_phone: phone, items: items.filter((i) => i.description), vat_rate: vat, deposit_percent: deposit === '' ? null : Number(deposit), valid_until: valid, notes }, actor), t('ส่งใบเสนอราคาให้ลูกค้าแล้ว', 'Quotation sent to customer'));
            setBusy(false); if (ok) onClose();
          }}>{t('ส่งใบเสนอราคา', 'Send quotation')}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function Kpi({ label, value, tone = 'default', onClick }: { label: string; value: React.ReactNode; tone?: 'default' | 'warn' | 'red'; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn('rounded-2xl border bg-white p-4 text-left transition hover:shadow-card', tone === 'warn' && 'border-amber-200 bg-amber-50/60', tone === 'red' && 'border-brand-red/20 bg-red-50/50')}>
      <p className="font-display text-2xl font-bold tabular-nums md:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-600 md:text-sm">{label}</p>
    </button>
  );
}
