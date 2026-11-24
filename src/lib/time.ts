// Time helpers. Journey dates and activity times are stored as LOCAL wall-clock
// strings plus an IANA zone, so they never shift when the phone's zone changes.

export const TZ_LABELS: Record<string, string> = {
  'Asia/Shanghai': 'Giờ Trung Quốc (UTC+8)',
  'Asia/Seoul': 'Giờ Hàn Quốc (UTC+9)',
  'Asia/Ho_Chi_Minh': 'Giờ Việt Nam (UTC+7)',
  'Asia/Tokyo': 'Giờ Nhật Bản (UTC+9)',
  'Europe/Paris': 'Giờ Paris',
  UTC: 'UTC',
};
export const tzLabel = (tz: string) => TZ_LABELS[tz] ?? tz;

/** Today's date (YYYY-MM-DD) in a given IANA zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}
/** Current wall-clock HH:mm in a zone. */
export function timeIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function weekdayVi(date: string): string {
  const w = new Date(date + 'T00:00:00Z').getUTCDay();
  return ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][w];
}
export function fmtDateVi(date: string): string {
  const [y, m, d] = date.split('-');
  return `${weekdayVi(date)}, ${Number(d)}/${Number(m)}/${y}`;
}
export function fmtShort(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
}
