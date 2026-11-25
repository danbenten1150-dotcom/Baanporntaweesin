// Auto-saved booking draft: what a customer typed survives going back/forward, reloads
// and leaving the page. Photos cannot be stored in a draft and must be re-attached.

import type { CargoCategory, ContactInfo } from './types';

export const DRAFT_KEY = 'bpt.booking.draft.v2';

export interface DraftItem {
  category: CargoCategory; description: string; quantity: string;
  weight: string; weight_unit: 'kg' | 'ton'; weight_unknown: boolean;
  length_m: string; width_m: string; height_m: string; size_unknown: boolean;
  vehicle_reg: string;
}
export interface BookingDraft {
  step: number;
  origin: string; dest: string; date: string; scheduleId: string; noSchedule: boolean;
  items: DraftItem[];
  needPickup: boolean; needDelivery: boolean; pickup: string; delivery: string; notes: string;
  contact: ContactInfo;
  savedAt?: string;
}

export const newDraftItem = (category: CargoCategory = 'general', weight = ''): DraftItem => ({
  category, description: '', quantity: '1', weight, weight_unit: 'ton', weight_unknown: false,
  length_m: '', width_m: '', height_m: '', size_unknown: false, vehicle_reg: '',
});

export const emptyDraft = (): BookingDraft => ({
  step: 0, origin: '', dest: '', date: '', scheduleId: '', noSchedule: false,
  items: [newDraftItem()], needPickup: false, needDelivery: false, pickup: '', delivery: '', notes: '',
  contact: { type: 'individual', full_name: '', company_name: '', phone: '', email: '', line_id: '', tax_id: '' },
});

export function readDraft(): BookingDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return emptyDraft();
}

export function writeDraft(patch: Partial<BookingDraft>) {
  try {
    const next = { ...readDraft(), ...patch, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
