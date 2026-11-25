import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TZ = 'Asia/Bangkok';

export function formatTHB(n: number | null | undefined, lang: 'th' | 'en' = 'th') {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency', currency: 'THB', maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(iso: string | null | undefined, lang: 'th' | 'en' = 'th', withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

export function formatTime(iso: string, lang: 'th' | 'en' = 'th') {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

/** YYYY-MM-DD for a Date in Thailand time. */
export function bkkDateKey(d: Date | string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(typeof d === 'string' ? new Date(d) : d);
  return parts; // en-CA yields YYYY-MM-DD
}

export function todayKey() {
  return bkkDateKey(new Date());
}

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Human friendly unique reference, e.g. BPT-C-261125-7KQ4M */
export function makeRef(prefix: 'C' | 'K' | 'M' | 'O' | 'Q' | 'P' | 'S') {
  const d = bkkDateKey(new Date()).replace(/-/g, '').slice(2);
  let rand = '';
  const buf = new Uint32Array(5);
  if (typeof crypto !== 'undefined') crypto.getRandomValues(buf);
  for (let i = 0; i < 5; i++) rand += REF_CHARS[(buf[i] || Math.floor(Math.random() * 1e9)) % REF_CHARS.length];
  return `BPT-${prefix}-${d}-${rand}`;
}

export function normalizePhone(p: string) {
  const digits = (p || '').replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length === 11) return '0' + digits.slice(2);
  return digits;
}

export function toTons(weight: number, unit: 'kg' | 'ton') {
  return unit === 'kg' ? weight / 1000 : weight;
}

export function downloadFile(filename: string, content: string, mime = 'text/html;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Excel workbook (SpreadsheetML 2003) — opens directly in Excel / Google Sheets / Numbers, Thai text intact. */
export function toExcel(rows: Record<string, unknown>[], sheet = 'Sheet1') {
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const x = (v: unknown) => escapeHtml(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const cell = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${x(v)}</Data></Cell>`);
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#FFD600" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="${x(sheet).slice(0, 31)}"><Table>
<Row>${cols.map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${x(c)}</Data></Cell>`).join('')}</Row>
${rows.map((r) => `<Row>${cols.map((c) => cell(r[c])).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
}

/** Opens a printable document; falls back to a download where pop-ups are blocked. */
export function printHtml(filename: string, html: string) {
  const w = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (w) {
    w.document.write(html.replace('</body>', '<script>window.onload=()=>{window.print()}</script></body>'));
    w.document.close();
  } else downloadFile(filename, html);
}
