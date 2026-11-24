// Data model. One source of truth, multiple views: every record has a stable id
// and belongs to exactly one store. Views (Wallet, Budget, Food, Map…) reference
// ids instead of copying records.

export const SCHEMA_VERSION = 3; // v2 (app 1.0.1): attachments store, canonical booking records · v3 (1.0.2): content translations
export const BACKUP_FORMAT = 'chang-journey-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const IMPORT_FORMAT = 'chang-journey-import';
export const IMPORT_FORMAT_VERSION = 1;

export type ID = string;
export type ThemeId = 'christmas-emerald' | 'sakura-dreams' | 'autumn-letters' | 'celestial-night' | 'custom';

export type ActivityStatus = 'draft' | 'tentative' | 'booked' | 'completed' | 'cancelled';
export type BookingStatus =
  | 'info-entered'
  | 'reservation-requested'
  | 'confirmed'
  | 'payment-pending'
  | 'partially-paid'
  | 'paid'
  | 'cancelled';
export type Privacy = 'normal' | 'private';

export interface BackgroundSetting {
  blobId: ID;
  posX: number; // 0..100 (%), object-position
  posY: number;
  zoom: number; // 1..2.5
  darken: number; // 0..0.8
  blur: number; // px 0..12
}

export interface JourneySettings {
  theme: ThemeId;
  customColors?: { bg: string; accent: string; card: string; text: string };
  fontStyle: 'storybook' | 'modern' | 'handwritten';
  animations: 'full' | 'reduced' | 'off';
  openingAnimation: boolean;
  decorations: boolean; // snow / particles / tree lights
  sound: boolean; // ambience preference (still only plays after explicit tap)
  backgrounds: Record<string, BackgroundSetting | undefined>; // key: 'home' | page key
  rotateBackgrounds: ID[]; // optional per-day rotation blob ids for home
  coverBlobId?: ID;
  exchangeRates?: { KRW?: ManualRate; VND?: ManualRate };
}
export interface ManualRate { perUnit: number; enteredAt: string; note?: string }

export interface Journey {
  id: ID;
  title: string;
  subtitle?: string;
  destinations: string[];
  startDate: string; // YYYY-MM-DD (local journey dates)
  endDate: string;
  timeZone: string; // IANA, journey primary
  currency: string; // ISO code
  notes: string;
  coverEmoji: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  seedKey?: string; // import key from a private journey file — prevents duplicate imports
  // Optional journey-specific content. It lives in the user's private import file, never in the app source.
  coverArt?: 'xmas-skyline';
  adventMessages?: string[];
  transportNotes?: string[];
  extraPhrases?: { group: string; zh: string; py: string; vi: string; en: string }[];
  wardrobeHint?: string;
  wardrobePlaceholder?: string;
  postcardDefault?: string;
  settings: JourneySettings;
  hotel?: { name: string; nameZh?: string; addressZh?: string; addressEn?: string; note?: string; verified: boolean };
  /** v2: canonical hotel booking record in Wallet. When set, it is the source of truth for hotel info. */
  hotelDocId?: ID;
  travelCard?: TravelCardSettings;
  /** Optional translations of record text, supplied by the user/import file. Never machine-generated. */
  i18n?: LocalizedText;
}

export interface Day {
  id: ID;
  journeyId: ID;
  index: number; // 1-based
  date: string; // YYYY-MM-DD
  title: string;
  subtitle?: string;
  freeDay: boolean; // no reminders, no fixed activities
  privateByDefault: boolean;
  notes: string;
  remindFrom?: string; // YYYY-MM-DD: show this day's note as an in-app reminder from this date until the trip starts
  i18n?: LocalizedText;
}

export interface Activity {
  id: ID;
  journeyId: ID;
  dayId: ID;
  order: number;
  title: string;
  start?: string; // HH:mm local
  end?: string;
  approxTime?: boolean; // "around"
  timeZone: string; // IANA
  timeZoneLabel?: string; // e.g. 'Giờ Hàn Quốc (UTC+9)'
  placeId?: ID;
  nameZh?: string;
  pinyin?: string;
  descriptionVi?: string;
  i18n?: LocalizedText;
  notes: string;
  status: ActivityStatus;
  optional?: boolean;
  kind: 'sight' | 'transport' | 'flight' | 'meal' | 'rest' | 'hotel' | 'photo' | 'other';
  unverified?: string; // human note on what is unverified
  poseIds: ID[];
  documentIds: ID[];
  expenseIds: ID[];
  photoBlobIds: ID[];
}

export interface Place {
  id: ID;
  journeyId: ID;
  name: string; // display (Vietnamese/English)
  nameZh?: string;
  pinyin?: string;
  aliases: string[];
  city: string;
  addressZh?: string;
  addressEn?: string;
  lat?: number; // approximate, schematic only
  lng?: number;
  wishlist: boolean;
  visitedAt?: string; // only set by explicit user stamp
  notes: string;
}

export interface WalletDoc {
  id: ID;
  journeyId: ID;
  title: string;
  category: 'flight' | 'train' | 'hotel' | 'ticket' | 'reservation' | 'qr' | 'receipt' | 'confirmation' | 'immigration' | 'other';
  bookingStatus: BookingStatus;
  dayId?: ID;
  activityIds: ID[];
  details: string; // booking reference etc — user-entered only
  /** v1 only: single original file. Migrated to an Attachment in schema v2 (kept for safety, no longer read). */
  blobId?: ID;
  mime?: string;
  fileName?: string;
  size?: number;
  privacy: Privacy;
  encrypted?: boolean;
  createdAt: string;
  lastOpenedOkAt?: string; // set only after the blob was actually read and rendered
  // ── v2 ──
  /** 'booking' = one canonical record per flight segment / hotel stay / train / reservation; 'document' = standalone file holder */
  recordType?: 'booking' | 'document';
  /** Attachments linked to this record. One attachment may be linked from several records (no file duplication). */
  attachmentIds?: ID[];
  paymentStatus?: PaymentStatus;
  flight?: FlightInfo;
  hotel?: HotelInfo;
}

export type PaymentStatus = 'unknown' | 'not-required' | 'pending' | 'partially-paid' | 'paid' | 'refunded';

export interface FlightInfo {
  direction?: 'outbound' | 'return' | 'other';
  airline?: string;
  flightNumber?: string;
  depAirport?: string;
  arrAirport?: string;
  depTerminal?: string;
  arrTerminal?: string;
  depDate?: string; // YYYY-MM-DD local
  depTime?: string; // HH:mm local
  depTz?: string;
  arrDate?: string;
  arrTime?: string;
  arrTz?: string;
  passenger?: string;
  bookingRef?: string; // sensitive: excluded from shared/printed card by default
  seat?: string;
  baggage?: string;
}

export interface HotelInfo { name?: string; nameZh?: string; addressZh?: string; addressEn?: string; phone?: string; checkIn?: string; checkOut?: string; bookingRef?: string }

export type AttachmentKind = 'eticket' | 'confirmation' | 'boarding-pass' | 'qr' | 'photo' | 'screenshot' | 'receipt' | 'other';
/** One stored file (bytes live in 'blobs'); linked from any number of WalletDoc records via attachmentIds. */
export interface Attachment {
  id: ID;
  journeyId: ID;
  blobId: ID;
  kind: AttachmentKind;
  label: string; // user-editable display name
  fileName: string;
  mime: string;
  size: number;
  createdAt: string;
  lastOpenedOkAt?: string;
}

/** Which canonical records the travel information card shows. */
export interface TravelCardSettings {
  outboundId?: ID;
  returnId?: ID;
  hotelId?: ID;
  purpose: 'tourism' | 'business' | 'family' | 'other';
  show: { airportTimes: boolean; airline: boolean; hotelContact: boolean; itinerary: boolean; documents: boolean; bookingRefs: boolean };
}

export type ExpenseCategory = 'transport' | 'food' | 'hotel' | 'tickets' | 'photo' | 'shopping' | 'gifts' | 'other';
export interface Payment { id: ID; amount: number; kind: 'deposit' | 'payment' | 'refund'; date: string; note?: string }
export interface Expense {
  id: ID;
  journeyId: ID;
  title: string;
  category: ExpenseCategory;
  dayId?: ID;
  activityId?: ID;
  currency: string;
  estimate?: number; // planned / quoted (not paid)
  estimateHigh?: number; // optional upper bound of a range
  payments: Payment[]; // actual money movement — the only thing counted as spent
  receiptBlobIds: ID[];
  notes: string;
  createdAt: string;
}

export interface Memory {
  id: ID;
  journeyId: ID;
  dayId?: ID;
  title: string;
  body: string; // simple markup: **bold**, _italic_
  layout: 'classic' | 'polaroid' | 'letter' | 'scrapbook';
  photoBlobIds: ID[];
  keepsake: boolean;
  privacy: Privacy;
  encrypted?: { iv: string; data: string }; // when private & vault-locked: title/body/photo ids live here
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntry {
  id: ID;
  journeyId: ID;
  city: string;
  dish: string;
  place?: string;
  address?: string;
  price?: number;
  currency: string;
  rating?: number; // 1..5
  notes: string;
  photoBlobIds: ID[];
  stamped: boolean; // manual stamp only
  expenseId?: ID;
  createdAt: string;
}

export interface Pose {
  id: ID;
  journeyId: ID;
  category: 'hanfu' | 'portrait' | 'couple' | 'street' | 'night' | 'architecture' | 'seasonal';
  title: string;
  description: string;
  favorite: boolean;
  notes: string;
  refBlobIds: ID[];
  activityIds: ID[];
  builtin: boolean;
}

export interface ChecklistItem { id: ID; journeyId: ID; group: string; text: string; done: boolean; order: number }

export interface Capsule {
  id: ID;
  journeyId: ID;
  title: string;
  kind: 'capsule' | 'future-letter';
  letter: string;
  blobIds: ID[];
  unlockDate: string; // YYYY-MM-DD
  openedEarly: boolean;
  createdAt: string;
}

export interface Postcard { id: ID; journeyId: ID; blobId: ID; message: string; createdAt: string }

export interface BlobRecord { id: ID; journeyId?: ID; mime: string; name: string; size: number; data: Blob | ArrayBuffer; encrypted?: { iv: string }; createdAt: string }

export interface TravelWorldEntry { id: ID; name: string; country: string; status: 'wishlist' | 'visited'; visitedOn?: string; story: string; journeyId?: ID }

export interface WeatherSnapshot { journeyId: ID; city: string; fetchedAt: string; source: string; daily: { date: string; max: number; min: number; code: number }[] }

export interface GlobalSettings {
  id: 'global';
  language: 'vi' | 'zh' | 'en' | 'ko';
  reducedMotion: 'system' | 'on' | 'off';
  performanceMode: boolean;
  homeBackground?: BackgroundSetting;
  vault?: { salt: string; verifier: { iv: string; data: string }; iterations: number; createdAt: string };
  backups: BackupLog[];
  seeded: string[];
  translation?: TranslationSettings;
}
/** A saved translation of one user-entered text field. Stored on the device → readable offline. */
export interface ContentTranslation {
  id: ID; // `${store}|${recordId}|${field}|${lang}`
  journeyId: ID; // journey the record belongs to ('world' for Travel World entries)
  store: StoreName;
  recordId: ID;
  field: string; // e.g. 'title', 'notes', 'transportNotes.1'
  lang: UiLang;
  text: string;
  srcHash: string; // hash of the original text this translation was made from (detects edits → stale)
  srcLang: UiLang;
  source: 'machine' | 'manual';
  provider?: 'mymemory';
  at: string;
}

export interface TranslationSettings {
  consentAt?: string; // explicit opt-in to send selected text to the online translation service
  email?: string; // optional, raises the service's daily limit; stored only on this device
  auto: boolean; // translate new/changed content automatically when online
  categories: Record<string, boolean>;
  usage?: { day: string; chars: number };
}

export interface BackupLog { id: ID; createdAt: string; fileName: string; sha256: string; encrypted: boolean; saved?: string; verified?: string; size: number }

export const STORES = [
  'journeys', 'days', 'activities', 'places', 'docs', 'expenses', 'memories', 'food', 'poses',
  'checklist', 'capsules', 'postcards', 'blobs', 'world', 'weather', 'settings', 'attachments', 'translations',
] as const;

export type UiLang = 'vi' | 'zh' | 'en' | 'ko';
/** Per-language overrides for a record's title / description. Missing → the original field is shown. */
export type LocalizedText = Partial<Record<UiLang, { title?: string; subtitle?: string; description?: string }>>;
export type StoreName = (typeof STORES)[number];
