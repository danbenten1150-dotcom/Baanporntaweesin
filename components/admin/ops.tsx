'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Download, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import { BOOKING_FLOW, BOOKING_STATUS, CARGO_CATEGORY, PAYMENT_STATUS, TRANSPORT_MODE } from '@/lib/labels';
import type { BookingStatus, CargoBooking, Route, Schedule, Store, Vessel } from '@/lib/types';
import { bkkDateKey, cn, formatDate, formatTHB, formatTime, todayKey, toTons, uid } from '@/lib/utils';
import { Badge, Button, DemoTag, Field, Input, Modal, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { downloadSummary, Timeline } from '@/components/shared/forms';
import { DataTable, ImageUploadButton, Kpi, QuotationBuilder, RecordModal, useAction, useActor, useDanger, type FieldDef } from './kit';

export function Schedules({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const act = useAction();
  const danger = useDanger();
  const [edit, setEdit] = useState<Schedule | null>(null);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [showPast, setShowPast] = useState(false);
  const rows = useMemo(() => s.schedules.filter((x) => showPast || new Date(x.arrive_at) > new Date()).sort((a, b) => a.depart_at.localeCompare(b.depart_at)), [s, showPast]);
  const routeOpts = s.routes.map((r) => ({ value: r.id, label: lang === 'th' ? r.name_th : r.name_en }));
  const vesselOpts = s.vessels.map((v) => ({ value: v.id, label: `${v.name}${v.status !== 'active' ? ` (${v.status})` : ''}` }));
  const fields: FieldDef<Schedule>[] = [
    { key: 'route_id', label: t('เส้นทาง', 'Route'), type: 'select', options: routeOpts, required: true },
    { key: 'vessel_id', label: t('เรือ', 'Vessel'), type: 'select', options: vesselOpts, required: true },
    { key: 'depart_at', label: t('เวลาออกเรือ', 'Departure'), type: 'datetime', required: true },
    { key: 'arrive_at', label: t('เวลาถึงโดยประมาณ', 'Estimated arrival'), type: 'datetime', required: true },
    { key: 'capacity_tons', label: t('ความจุสินค้า (ตัน)', 'Cargo capacity (t)'), type: 'number', required: true },
    { key: 'vehicle_slots', label: t('ช่องยานพาหนะ', 'Vehicle slots'), type: 'number' },
    { key: 'status', label: t('สถานะ', 'Status'), type: 'select', options: ['open', 'full', 'closed', 'cancelled'].map((x) => ({ value: x, label: x })) },
  ];
  const newSchedule = (): Schedule => { const v = s.vessels.find((x) => x.status === 'active'); const d = new Date(Date.now() + 86400000); return { id: uid(), route_id: s.routes[0]?.id || '', vessel_id: v?.id || '', depart_at: d.toISOString(), arrive_at: new Date(d.getTime() + 3 * 3600000).toISOString(), capacity_tons: v?.cargo_capacity_tons || 0, booked_tons: 0, vehicle_slots: v?.vehicle_capacity || 0, booked_vehicles: 0, status: 'open' }; };
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold">{t('รอบเดินเรือ', 'Sailings')}</h3>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setShowPast(!showPast)}>{showPast ? t('ซ่อนรอบที่ผ่านมา', 'Hide past') : t('แสดงรอบที่ผ่านมา', 'Show past')}</Button><Button size="sm" onClick={() => setEdit(newSchedule())}><Plus className="h-4 w-4" />{t('เพิ่มรอบเรือ', 'Add sailing')}</Button></div>
        </div>
        <DataTable rows={rows} onRow={setEdit} empty={t('ยังไม่มีรอบเรือ', 'No sailings')} cols={[
          { label: t('ออกเรือ', 'Departs'), render: (x) => <span className="whitespace-nowrap">{formatDate(x.depart_at, lang)} <strong className="tabular-nums">{formatTime(x.depart_at, lang)}</strong></span> },
          { label: t('เส้นทาง', 'Route'), render: (x) => routeOpts.find((r) => r.value === x.route_id)?.label },
          { label: t('เรือ', 'Vessel'), render: (x) => s.vessels.find((v) => v.id === x.vessel_id)?.name },
          { label: t('ความจุ', 'Capacity'), className: 'text-right', render: (x) => <span className="whitespace-nowrap tabular-nums">{x.booked_tons}/{x.capacity_tons} t · {x.booked_vehicles}/{x.vehicle_slots} 🚗</span> },
          { label: t('สถานะ', 'Status'), render: (x) => <div className="flex gap-1"><StatusBadge status={x.status} />{x.is_demo && <DemoTag />}</div> },
          { label: '', render: (x) => x.status !== 'cancelled' && <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); danger(t('ยกเลิกรอบเรือนี้?', 'Cancel this sailing?'), () => api.upsert('schedules', { ...x, status: 'cancelled' }), t('ยกเลิกรอบแล้ว — แจ้งลูกค้าและย้ายการจองในหน้าการจอง', 'Sailing cancelled — notify & move bookings from Bookings')); }}>{t('ยกเลิกรอบ', 'Cancel')}</Button> },
        ]} />
        <p className="text-xs text-neutral-500">{t('ระบบป้องกันการจองเกินความจุ และป้องกันเรือลำเดียวกันมีรอบซ้อนเวลา การเลื่อนรอบ: แก้ไขเวลาในรอบเดิม', 'Overbooking and overlapping sailings for the same vessel are blocked. To reschedule, edit the sailing times.')}</p>
      </section>
      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold">{t('เส้นทาง', 'Routes')}</h3>
        <DataTable rows={s.routes} onRow={setEditRoute} empty="—" cols={[
          { label: t('รหัส', 'Code'), render: (r) => <span className="font-mono">{r.code}</span> },
          { label: t('ชื่อ', 'Name'), render: (r) => (lang === 'th' ? r.name_th : r.name_en) },
          { label: t('อัตรา/ตัน', 'Rate / t'), className: 'text-right', render: (r) => (r.rate_per_ton != null ? formatTHB(r.rate_per_ton, lang) : <span className="text-neutral-500">{t('เสนอราคาเอง', 'manual quote')}</span>) },
          { label: t('สถานะ', 'Status'), render: (r) => <Badge tone={r.active ? 'ok' : 'neutral'}>{r.active ? t('เปิด', 'Active') : t('ปิด', 'Inactive')}</Badge> },
        ]} />
      </section>
      <RecordModal open={!!edit} title={t('รอบเดินเรือ', 'Sailing')} initial={edit} fields={fields} onClose={() => setEdit(null)} onSave={(r) => act(() => api.upsert('schedules', r), t('บันทึกแล้ว', 'Saved'))} />
      <RecordModal open={!!editRoute} title={t('เส้นทาง', 'Route')} initial={editRoute} onClose={() => setEditRoute(null)} onSave={(r) => act(() => api.upsert('routes', r), t('บันทึกแล้ว', 'Saved'))} fields={[
        { key: 'name_th', label: 'ชื่อ (ไทย)', required: true }, { key: 'name_en', label: 'Name (EN)', required: true },
        { key: 'duration_min', label: t('เวลาเดินทาง (นาที)', 'Duration (min)'), type: 'nullable-number' },
        { key: 'rate_per_ton', label: t('อัตราประมาณการต่อตัน (บาท)', 'Estimate rate per tonne (THB)'), type: 'nullable-number', hint: t('ใส่เฉพาะราคาที่ยืนยันแล้ว', 'Only enter verified rates') },
        { key: 'active', label: t('เปิดให้จอง', 'Open for booking'), type: 'checkbox' },
      ]} />
    </div>
  );
}

export function Vessels({ s }: { s: Store }) {
  const { t } = useLang();
  const act = useAction();
  const danger = useDanger();
  const [edit, setEdit] = useState<Vessel | null>(null);
  const fields: FieldDef<Vessel>[] = [
    { key: 'name', label: t('ชื่อเรือ', 'Vessel name'), required: true }, { key: 'vessel_type', label: t('ประเภท', 'Type') },
    { key: 'cargo_capacity_tons', label: t('ความจุสินค้า (ตัน)', 'Cargo capacity (t)'), type: 'number', required: true },
    { key: 'vehicle_capacity', label: t('ความจุยานพาหนะ (คัน)', 'Vehicle capacity'), type: 'number' },
    { key: 'status', label: t('สถานะ / ซ่อมบำรุง', 'Status / maintenance'), type: 'select', options: [{ value: 'active', label: t('พร้อมใช้งาน', 'Active') }, { value: 'maintenance', label: t('ซ่อมบำรุง', 'Maintenance') }, { value: 'inactive', label: t('ไม่ใช้งาน', 'Inactive') }] },
    { key: 'photo_url', label: t('URL รูปเรือ', 'Photo URL'), hint: t('หรืออัปโหลดด้านล่าง', 'or upload below'), full: true },
    { key: 'notes', label: t('หมายเหตุ', 'Notes'), type: 'textarea' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ id: uid(), name: '', vessel_type: '', cargo_capacity_tons: 0, vehicle_capacity: 0, status: 'active', notes: '' })}><Plus className="h-4 w-4" />{t('เพิ่มเรือ', 'Add vessel')}</Button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.vessels.map((v) => (
          <div key={v.id} className="rounded-2xl border bg-white p-5">
            <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{v.name}</p><p className="text-sm text-neutral-500">{v.vessel_type}</p></div><div className="flex gap-1"><Badge tone={v.status === 'active' ? 'ok' : v.status === 'maintenance' ? 'warn' : 'neutral'}>{v.status}</Badge>{v.is_demo && <DemoTag />}</div></div>
            {v.photo_url && <img src={v.photo_url} alt={v.name} className="mt-3 aspect-video w-full rounded-xl object-cover" />}
            <p className="mt-3 text-sm tabular-nums">{v.cargo_capacity_tons} {t('ตัน', 't')} · {v.vehicle_capacity} {t('คัน', 'vehicles')}</p>
            <p className="text-xs text-neutral-500">{s.schedules.filter((x) => x.vessel_id === v.id && new Date(x.depart_at) > new Date() && x.status !== 'cancelled').length} {t('รอบที่จะถึง', 'upcoming sailings')}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(v)}><Pencil className="h-4 w-4" />{t('แก้ไข', 'Edit')}</Button>
              <ImageUploadButton folder="vessels" onUrl={(url) => act(() => api.upsert('vessels', { ...v, photo_url: url }), t('อัปโหลดแล้ว', 'Uploaded'))} />
              <Button size="sm" variant="danger" onClick={() => danger(t('ลบรายการนี้?', 'Delete this item?'), () => api.remove('vessels', v.id), t('ลบแล้ว', 'Deleted'))} aria-label={t('ลบ', 'Delete')}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <RecordModal open={!!edit} title={t('ข้อมูลเรือ', 'Vessel')} initial={edit} fields={fields} onClose={() => setEdit(null)} onSave={(r) => act(() => api.upsert('vessels', r), t('บันทึกแล้ว', 'Saved'))} />
    </div>
  );
}
