'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { api } from '@/lib/data';
import type { GalleryCategory, GalleryItem, Settings, Store } from '@/lib/types';
import { uid } from '@/lib/utils';
import { Alert, Button, Input, PhotoSlot, Tabs, useConfirm, useToast } from '@/components/ui';
import { GALLERY, SERVICES } from '@/components/home/Sections';
import { ImageUploadButton } from './kit';

/** Admin › Photos: service-card photos, homepage banner and the project gallery. */
export function MediaAdmin({ s }: { s: Store }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const confirm = useConfirm();
  const [cat, setCat] = useState<GalleryCategory>('cargo');
  // keep the latest settings in a ref so several uploads in a row never overwrite each other
  const latest = useRef<Settings>(s.settings);
  useEffect(() => { latest.current = s.settings; }, [s.settings]);
  const save = async (patch: Partial<Settings>) => {
    latest.current = { ...latest.current, ...patch };
    try { await api.saveSettings(latest.current); }
    catch { toast(t('บันทึกไม่สำเร็จ', 'Could not save'), 'bad'); }
  };
  const gallery = s.settings.gallery || [];
  const items = gallery.filter((g) => g.category === cat);
  const setGallery = (next: GalleryItem[]) => save({ gallery: next });
  const move = (id: string, dir: -1 | 1) => {
    const all = [...latest.current.gallery];
    const same = all.filter((g) => g.category === cat);
    const i = same.findIndex((g) => g.id === id), j = i + dir;
    if (j < 0 || j >= same.length) return;
    const a = all.indexOf(same[i]), b = all.indexOf(same[j]);
    [all[a], all[b]] = [all[b], all[a]];
    setGallery(all);
  };
  const vesselPhotos = s.vessels.filter((v) => v.photo_url && !v.is_demo).length;

  return (
    <div className="space-y-8">
      {api.mode === 'demo' && <Alert>{t('โหมดสาธิต: รูปถูกย่อขนาดและเก็บไว้ในเบราว์เซอร์นี้เท่านั้น เมื่อขึ้นเว็บจริง รูปจะเก็บบนเซิร์ฟเวอร์และลูกค้าทุกคนเห็น', 'Demo mode: photos are resized and kept in this browser only. On the live site they are stored on the server for everyone.')}</Alert>}

      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-display text-lg font-bold">{t('แบนเนอร์หน้าแรก', 'Homepage banner')}</h3>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="aspect-[4/3] w-40 overflow-hidden rounded-xl"><PhotoSlot src={s.settings.hero_image_url || '/images/banner-truck-crane.webp'} alt="" /></div>
          <div className="flex flex-wrap gap-2">
            <ImageUploadButton folder="site" label={t('เปลี่ยนรูป', 'Replace photo')} onUrl={(url) => save({ hero_image_url: url }).then(() => toast(t('เปลี่ยนรูปแล้ว', 'Photo updated')))} />
            {s.settings.hero_image_url && <Button size="sm" variant="ghost" onClick={() => save({ hero_image_url: '' })}><RotateCcw className="h-4 w-4" />{t('ใช้รูปเดิม', 'Use default')}</Button>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-display text-lg font-bold">{t('รูปการ์ดบริการ', 'Service card photos')}</h3>
        <p className="mt-1 text-sm text-neutral-500">{t('แสดงในหน้าแรกและหน้าบริการของเรา', 'Shown on the homepage and the services page')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((sv) => {
            const custom = s.settings.service_images?.[sv.id];
            return (
              <div key={sv.id} className="overflow-hidden rounded-xl border">
                <div className="aspect-[16/10]"><PhotoSlot src={custom || sv.img} alt={lang === 'th' ? sv.th : sv.en} label={lang === 'th' ? sv.th : sv.en} icon={sv.icon} /></div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-sm font-semibold">{lang === 'th' ? sv.th : sv.en}</span>
                  <div className="flex gap-1">
                    <ImageUploadButton folder="site" label={custom ? t('เปลี่ยน', 'Replace') : t('อัปโหลด', 'Upload')}
                      onUrl={(url) => save({ service_images: { ...latest.current.service_images, [sv.id]: url } }).then(() => toast(t('บันทึกรูปแล้ว', 'Photo saved')))} />
                    {custom && <Button size="sm" variant="ghost" aria-label={t('ลบรูป', 'Remove photo')} onClick={() => { const { [sv.id]: _x, ...rest } = latest.current.service_images; save({ service_images: rest }); }}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">{t('แกลเลอรีผลงาน', 'Project gallery')}</h3>
            <p className="mt-1 text-sm text-neutral-500">{t('เลือกหมวด แล้วอัปโหลดได้หลายรูปพร้อมกัน', 'Pick a category, then upload several photos at once')}</p>
          </div>
          <ImageUploadButton folder="site" multiple label={t('+ เพิ่มรูป', '+ Add photos')}
            onUrl={(url) => save({ gallery: [...latest.current.gallery, { id: uid(), category: cat, url, caption_th: '', caption_en: '' }] })} />
        </div>
        <Tabs className="mt-4" value={cat} onChange={setCat} items={GALLERY.map((g) => ({ value: g.id as GalleryCategory, label: t(g.th, g.en), count: gallery.filter((x) => x.category === g.id).length }))} />
        {cat === 'fleet' && <p className="mt-3 text-sm text-neutral-500">{t(`รูปเรือจากเมนู “เรือ” จะแสดงในหมวดนี้อัตโนมัติ (ตอนนี้ ${vesselPhotos} รูป)`, `Vessel photos from “Vessels” also appear here automatically (${vesselPhotos} now)`)}</p>}
        {items.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-neutral-500">{t('ยังไม่มีรูปในหมวดนี้ — หน้าเว็บจะแสดงกรอบรูปว่างไว้ก่อน', 'No photos yet — the site shows placeholders until you add some')}</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((g, i) => (
              <div key={g.id} className="overflow-hidden rounded-xl border">
                <div className="aspect-[4/3]"><img src={g.url} alt={g.caption_th} className="h-full w-full object-cover" /></div>
                <div className="space-y-2 p-3">
                  <Input placeholder="คำบรรยาย (ไทย)" defaultValue={g.caption_th} onBlur={(e) => e.target.value !== g.caption_th && setGallery(latest.current.gallery.map((x) => (x.id === g.id ? { ...x, caption_th: e.target.value } : x)))} />
                  <Input placeholder="Caption (EN)" defaultValue={g.caption_en} onBlur={(e) => e.target.value !== g.caption_en && setGallery(latest.current.gallery.map((x) => (x.id === g.id ? { ...x, caption_en: e.target.value } : x)))} />
                  <div className="flex justify-between">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(g.id, -1)} aria-label={t('เลื่อนซ้าย', 'Move left')}><ArrowLeft className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(g.id, 1)} aria-label={t('เลื่อนขวา', 'Move right')}><ArrowRight className="h-4 w-4" /></Button>
                    </div>
                    <Button size="sm" variant="danger" onClick={async () => { if (await confirm({ title: t('ลบรูปนี้?', 'Delete this photo?'), confirm: t('ลบรูป', 'Delete'), danger: true })) setGallery(latest.current.gallery.filter((x) => x.id !== g.id)); }}><Trash2 className="h-4 w-4" />{t('ลบ', 'Delete')}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
