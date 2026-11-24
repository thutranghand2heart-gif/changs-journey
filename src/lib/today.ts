import type { Activity, Day, Journey, WalletDoc } from '../db/schema';
import { daysBetween, timeIn, todayIn } from './time';

export interface TodayInfo {
  phase: 'before' | 'during' | 'after';
  localDate: string;
  localTime: string;
  daysUntil: number;
  day?: Day;
  upcoming: Activity[];
  reminders: { text: string; link?: string; priority?: boolean }[];
  calm: boolean; // free day — show nothing scheduled
}

/** Computed only when the app is open; nothing is scheduled in the background. */
export function smartToday(j: Journey, days: Day[], acts: Activity[], docs: WalletDoc[], now: Date = new Date()): TodayInfo {
  const localDate = todayIn(j.timeZone, now);
  const localTime = timeIn(j.timeZone, now);
  const phase = localDate < j.startDate ? 'before' : localDate > j.endDate ? 'after' : 'during';
  const day = days.find((d) => d.date === localDate);
  const info: TodayInfo = { phase, localDate, localTime, daysUntil: Math.max(0, daysBetween(localDate, j.startDate)), day, upcoming: [], reminders: [], calm: !!day?.freeDay };
  const base = `/j/${j.id}`;

  if (phase === 'before') {
    const flightDocs = docs.filter((d) => d.category === 'flight');
    if (flightDocs.length && flightDocs.every((d) => !d.blobId)) info.reminders.push({ text: 'Chưa có vé/QR chuyến bay thật trong Ví — hãy thêm bản gốc.', link: `${base}/wallet` });
    const pending = docs.filter((d) => d.bookingStatus === 'payment-pending' || d.bookingStatus === 'reservation-requested');
    for (const d of pending) info.reminders.push({ text: `Đang chờ: ${d.title} (${d.bookingStatus === 'payment-pending' ? 'chờ thanh toán' : 'đã gửi yêu cầu'})`, link: `${base}/wallet` });
    for (const d of days) if (!d.freeDay && d.remindFrom && d.notes && localDate >= d.remindFrom) info.reminders.push({ text: `Ngày ${d.index}: ${d.notes}`, link: `${base}/journey/${d.id}` });
    if (info.daysUntil <= 14) info.reminders.push({ text: 'Trước khi đi: chạy Kiểm tra sẵn sàng offline và tạo bản sao lưu.', link: '/offline' });
  }

  if (phase === 'during' && day && !day.freeDay) {
    const todays = acts.filter((a) => a.dayId === day.id && a.status !== 'cancelled').sort((a, b) => a.order - b.order);
    // compare only activities in the journey's own zone; other-zone items (e.g. Korea arrival) are listed but not timed against "now"
    info.upcoming = todays.filter((a) => !a.start || a.timeZone !== j.timeZone || a.start >= localTime).slice(0, 3);
    const isLast = day.date === j.endDate;
    if (isLast) {
      for (const a of todays.filter((x) => x.kind === 'flight' || x.kind === 'hotel' || x.kind === 'transport'))
        info.reminders.push({ text: `${a.start ?? ''} ${a.title}${a.timeZoneLabel ? ` (${a.timeZoneLabel})` : ''}`.trim(), link: `${base}/journey/${day.id}?a=${a.id}`, priority: true });
      info.reminders.push({ text: 'Mở sẵn vé máy bay trong Ví', link: `${base}/wallet`, priority: true });
    }
  }
  // Free day: deliberately no upcoming items and no reminders.
  if (info.calm) {
    info.upcoming = [];
    info.reminders = [];
  }
  return info;
}
