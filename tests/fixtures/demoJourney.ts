// FICTIONAL demo journey used by public tests. Contains no real person's travel plans.
import type { Activity, Day, Journey } from '../../src/db/schema';
import type { JourneyBundle } from '../../src/lib/journeyFile';

const J = 'demo-journey';
const T = 'Asia/Tokyo';
const day = (n: number, date: string, extra: Partial<Day> = {}): Day => ({ id: `demo-d${n}`, journeyId: J, index: n, date, title: `Demo day ${n}`, freeDay: false, privateByDefault: false, notes: '', ...extra });
let o = 0;
const act = (d: number, a: Partial<Activity> & { title: string }): Activity => ({
  id: `demo-a${++o}`, journeyId: J, dayId: `demo-d${d}`, order: o, timeZone: T, timeZoneLabel: 'Demo time (UTC+9)', notes: '', status: 'tentative', kind: 'sight',
  poseIds: [], documentIds: [], expenseIds: [], photoBlobIds: [], ...a,
});

export function buildDemoBundle(): JourneyBundle {
  o = 0;
  const journey: Journey = {
    id: J, title: 'Winter Lights Demo', subtitle: 'Fictional test journey', destinations: ['Demo City'], startDate: '2031-01-10', endDate: '2031-01-12', timeZone: T, currency: 'JPY',
    notes: '', coverEmoji: '🎄', pinned: true, archived: false, createdAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z', seedKey: 'demo-2031', coverArt: 'xmas-skyline',
    hotel: { name: 'Demo Hotel', addressZh: '演示市示例路1号', addressEn: '1 Example Street, Demo City', verified: false },
    settings: { theme: 'christmas-emerald', fontStyle: 'storybook', animations: 'full', openingAnimation: true, decorations: true, sound: false, backgrounds: {}, rotateBackgrounds: [] },
    transportNotes: ['Demo transport note.'],
  };
  const days = [day(1, '2031-01-10', { notes: 'Check the demo booking page.', remindFrom: '2031-01-01' }), day(2, '2031-01-11', { freeDay: true, privateByDefault: true }), day(3, '2031-01-12')];
  const places = [
    { id: 'demo-pl-river', journeyId: J, name: 'Demo Riverside', nameZh: '演示河畔', pinyin: 'Yǎnshì Hépàn', aliases: ['riverside walk'], city: 'Demo City', addressZh: '演示市河畔路8号', lat: 35.0, lng: 135.0, wishlist: false, notes: '' },
    { id: 'demo-pl-airport', journeyId: J, name: 'Demo Airport', aliases: [], city: 'Demo City', addressZh: '演示机场', lat: 35.2, lng: 135.3, wishlist: false, notes: '' },
  ];
  const activities = [
    act(1, { title: 'Depart home', start: '07:00', kind: 'flight', timeZone: 'Asia/Ho_Chi_Minh', timeZoneLabel: 'Home time (UTC+7)' }),
    act(1, { title: 'Riverside — visit 1', start: '16:00', end: '17:30', placeId: 'demo-pl-river', nameZh: '演示河畔' }),
    act(1, { title: 'Riverside — visit 2', start: '20:00', end: '21:00', placeId: 'demo-pl-river', nameZh: '演示河畔' }),
    act(3, { title: 'Hotel checkout', start: '07:20', kind: 'hotel' }),
    act(3, { title: 'Demo flight DEMO 001 departs', start: '12:00', kind: 'flight', placeId: 'demo-pl-airport' }),
  ];
  const expenses = [{ id: 'demo-e1', journeyId: J, title: 'Demo photo package', category: 'photo' as const, dayId: 'demo-d1', currency: 'JPY', estimate: 10000, payments: [], receiptBlobIds: [], notes: 'Deposit 3000 requested, not paid.', createdAt: '2030-01-01T00:00:00.000Z' }];
  const docs = [{ id: 'demo-doc-flight', journeyId: J, title: 'Demo flight', category: 'flight' as const, bookingStatus: 'info-entered' as const, activityIds: [], details: 'Fictional', privacy: 'normal' as const, createdAt: '2030-01-01T00:00:00.000Z' }];
  const checklist = [{ id: 'demo-ck1', journeyId: J, group: 'Before', text: 'Pack', done: false, order: 1 }];
  return { journey, days, activities, places, docs, expenses, poses: [], checklist };
}
