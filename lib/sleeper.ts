// Shared sleeper-boat helpers used by the booking page, the admin and the demo adapter.
// The same rules run again in Postgres (submit_sleeper_booking) for the live site.
import type { Settings, SleeperBooking, SleeperDirection } from './types';
import { defaultSleeper } from './data/seed';

export const SLEEPER_DIR: Record<SleeperDirection, { th: string; en: string; from_th: string; to_th: string; from_en: string; to_en: string }> = {
  cpn_tao: { th: 'ชุมพร → เกาะเต่า', en: 'Chumphon → Koh Tao', from_th: 'ชุมพร', to_th: 'เกาะเต่า', from_en: 'Chumphon', to_en: 'Koh Tao' },
  tao_cpn: { th: 'เกาะเต่า → ชุมพร', en: 'Koh Tao → Chumphon', from_th: 'เกาะเต่า', to_th: 'ชุมพร', from_en: 'Koh Tao', to_en: 'Chumphon' },
};
export const WEEKDAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const WEEKDAY_TH_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Active seats = every request that is not cancelled/rejected (pending requests hold berths until staff decide). */
export const HOLDS = (b: Pick<SleeperBooking, 'status'>) => b.status !== 'cancelled' && b.status !== 'rejected';

export function sleeperConfig(s?: Settings | null) {
  const d = defaultSleeper();
  const c = s?.sleeper;
  if (!c) return d;
  return { ...d, ...c, legs: { cpn_tao: { ...d.legs.cpn_tao, ...c.legs?.cpn_tao }, tao_cpn: { ...d.legs.tao_cpn, ...c.legs?.tao_cpn } } };
}

/** Bangkok "today" as YYYY-MM-DD */
export function bkkToday() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function weekdayOf(date: string) {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}
function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** Upcoming sailing dates for a direction (from tomorrow, `weeks` ahead), excluding closed dates. */
export function sailingDates(s: Settings | null | undefined, dir: SleeperDirection, weeks = 8) {
  const c = sleeperConfig(s);
  const leg = c.legs[dir];
  const start = bkkToday();
  const out: string[] = [];
  for (let i = 0; i <= weeks * 7; i++) {
    const d = addDays(start, i);
    if (leg.weekdays.includes(weekdayOf(d)) && !c.closed_dates.includes(d)) out.push(d);
  }
  return out;
}

export function isSailingDate(s: Settings | null | undefined, dir: SleeperDirection, date: string) {
  const c = sleeperConfig(s);
  return date >= bkkToday() && c.legs[dir].weekdays.includes(weekdayOf(date)) && !c.closed_dates.includes(date);
}

export function seatsTaken(bookings: SleeperBooking[], dir: SleeperDirection, date: string, exceptId?: string) {
  return bookings.filter((b) => b.direction === dir && b.travel_date === date && HOLDS(b) && b.id !== exceptId).reduce((n, b) => n + b.seats, 0);
}

export function daysLabel(weekdays: number[], lang: 'th' | 'en') {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => weekdays.includes(d));
  return order.map((d) => (lang === 'th' ? WEEKDAY_TH[d] : WEEKDAY_EN[d])).join(lang === 'th' ? ' · ' : ', ');
}

export const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(d: string, lang: 'th' | 'en', long = false) {
  const [, m, day] = d.split('-').map(Number);
  const wd = weekdayOf(d);
  if (lang === 'th') return `${long ? 'วัน' + ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][wd] + 'ที่ ' : WEEKDAY_TH_SHORT[wd] + ' '}${day} ${MONTH_TH[m - 1]}${long ? ' ' + (Number(d.slice(0, 4)) + 543) : ''}`;
  return `${WEEKDAY_EN[wd]} ${day} ${MONTH_EN[m - 1]}${long ? ' ' + d.slice(0, 4) : ''}`;
}

