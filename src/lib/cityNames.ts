// Common city names in the four card languages, so the entry card shows proper Chinese (etc.) offline,
// even before any machine translation. Matching ignores case, accents and spaces.
import type { UiLang } from '../db/schema';

const CITIES: Record<UiLang, string>[] = [
  { vi: 'Thượng Hải', zh: '上海', en: 'Shanghai', ko: '상하이' },
  { vi: 'Tô Châu', zh: '苏州', en: 'Suzhou', ko: '쑤저우' },
  { vi: 'Hàng Châu', zh: '杭州', en: 'Hangzhou', ko: '항저우' },
  { vi: 'Bắc Kinh', zh: '北京', en: 'Beijing', ko: '베이징' },
  { vi: 'Nam Kinh', zh: '南京', en: 'Nanjing', ko: '난징' },
  { vi: 'Vô Tích', zh: '无锡', en: 'Wuxi', ko: '우시' },
  { vi: 'Chu Gia Giác', zh: '朱家角', en: 'Zhujiajiao', ko: '주자자오' },
  { vi: 'Châu Trang', zh: '周庄', en: 'Zhouzhuang', ko: '저우좡' },
  { vi: 'Đồng Lý', zh: '同里', en: 'Tongli', ko: '퉁리' },
  { vi: 'Ô Trấn', zh: '乌镇', en: 'Wuzhen', ko: '우전' },
  { vi: 'Tây Đường', zh: '西塘', en: 'Xitang', ko: '시탕' },
  { vi: 'Quảng Châu', zh: '广州', en: 'Guangzhou', ko: '광저우' },
  { vi: 'Thâm Quyến', zh: '深圳', en: 'Shenzhen', ko: '선전' },
  { vi: 'Thành Đô', zh: '成都', en: 'Chengdu', ko: '청두' },
  { vi: 'Tây An', zh: '西安', en: "Xi'an", ko: '시안' },
  { vi: 'Trùng Khánh', zh: '重庆', en: 'Chongqing', ko: '충칭' },
  { vi: 'Hồng Kông', zh: '香港', en: 'Hong Kong', ko: '홍콩' },
  { vi: 'Ma Cao', zh: '澳门', en: 'Macau', ko: '마카오' },
  { vi: 'Seoul', zh: '首尔', en: 'Seoul', ko: '서울' },
  { vi: 'Incheon', zh: '仁川', en: 'Incheon', ko: '인천' },
  { vi: 'Busan', zh: '釜山', en: 'Busan', ko: '부산' },
  { vi: 'Hà Nội', zh: '河内', en: 'Hanoi', ko: '하노이' },
  { vi: 'TP. Hồ Chí Minh', zh: '胡志明市', en: 'Ho Chi Minh City', ko: '호찌민' },
  { vi: 'Đà Nẵng', zh: '岘港', en: 'Da Nang', ko: '다낭' },
  { vi: 'Tokyo', zh: '东京', en: 'Tokyo', ko: '도쿄' },
  { vi: 'Osaka', zh: '大阪', en: 'Osaka', ko: '오사카' },
  { vi: 'Lâm Cảng', zh: '临港', en: 'Lingang', ko: '린강' },
  { vi: 'Phố Đông', zh: '浦东', en: 'Pudong', ko: '푸둥' },
  { vi: 'Trung Quốc', zh: '中国', en: 'China', ko: '중국' },
  { vi: 'Hàn Quốc', zh: '韩国', en: 'South Korea', ko: '한국' },
  { vi: 'Việt Nam', zh: '越南', en: 'Vietnam', ko: '베트남' },
  { vi: 'Nhật Bản', zh: '日本', en: 'Japan', ko: '일본' },
];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[\s.'’-]/g, '').toLowerCase();
const INDEX = new Map<string, Record<UiLang, string>>();
for (const c of CITIES) for (const v of Object.values(c)) INDEX.set(norm(v), c);
INDEX.set(norm('Ho Chi Minh'), CITIES.find((c) => c.en === 'Ho Chi Minh City')!);
INDEX.set(norm('Sài Gòn'), CITIES.find((c) => c.en === 'Ho Chi Minh City')!);

/** The city's name in `lang`, or undefined when the city isn't in the built-in list. */
export function cityName(city: string, lang: UiLang): string | undefined {
  const direct = INDEX.get(norm(city))?.[lang];
  if (direct) return direct;
  // "Thượng Hải (Lâm Cảng)" → "上海（临港）" when both parts are known
  const m = city.match(/^(.+?)\s*[(（](.+)[)）]\s*$/);
  if (!m) return undefined;
  const a = cityName(m[1], lang);
  const b = cityName(m[2], lang);
  if (!a || !b) return undefined;
  return lang === 'zh' ? `${a}（${b}）` : `${a} (${b})`;
}

// Airlines by IATA code (taken from the flight number, e.g. MU5052 → MU).
const AIRLINES: Record<string, Record<UiLang, string>> = {
  MU: { zh: '中国东方航空', en: 'China Eastern Airlines', ko: '중국동방항공', vi: 'China Eastern Airlines' },
  FM: { zh: '上海航空', en: 'Shanghai Airlines', ko: '상하이항공', vi: 'Shanghai Airlines' },
  CA: { zh: '中国国际航空', en: 'Air China', ko: '중국국제항공', vi: 'Air China' },
  CZ: { zh: '中国南方航空', en: 'China Southern Airlines', ko: '중국남방항공', vi: 'China Southern Airlines' },
  HO: { zh: '吉祥航空', en: 'Juneyao Air', ko: '준야오항공', vi: 'Juneyao Air' },
  '9C': { zh: '春秋航空', en: 'Spring Airlines', ko: '춘추항공', vi: 'Spring Airlines' },
  KE: { zh: '大韩航空', en: 'Korean Air', ko: '대한항공', vi: 'Korean Air' },
  OZ: { zh: '韩亚航空', en: 'Asiana Airlines', ko: '아시아나항공', vi: 'Asiana Airlines' },
  '7C': { zh: '济州航空', en: 'Jeju Air', ko: '제주항공', vi: 'Jeju Air' },
  LJ: { zh: '真航空', en: 'Jin Air', ko: '진에어', vi: 'Jin Air' },
  TW: { zh: '德威航空', en: "T'way Air", ko: '티웨이항공', vi: "T'way Air" },
  VN: { zh: '越南航空', en: 'Vietnam Airlines', ko: '베트남항공', vi: 'Vietnam Airlines' },
  VJ: { zh: '越捷航空', en: 'VietJet Air', ko: '비엣젯항공', vi: 'Vietjet Air' },
};
/** Airline name in `lang` from the flight number's IATA prefix, when known. */
export function airlineName(flightNumber: string | undefined, lang: UiLang): string | undefined {
  const code = flightNumber?.trim().toUpperCase().match(/^([A-Z0-9]{2})\s?\d/)?.[1];
  return code ? AIRLINES[code]?.[lang] : undefined;
}

const AIRPORTS: { keys: string[]; names: Record<UiLang, string> }[] = [
  { keys: ['ICN', 'Incheon', '인천', '仁川'], names: { zh: '仁川国际机场', en: 'Incheon International Airport', ko: '인천국제공항', vi: 'Sân bay quốc tế Incheon' } },
  { keys: ['GMP', 'Gimpo', '김포', '金浦'], names: { zh: '金浦国际机场', en: 'Gimpo International Airport', ko: '김포국제공항', vi: 'Sân bay quốc tế Gimpo' } },
  { keys: ['PVG', 'Pudong', 'Phố Đông', '浦东'], names: { zh: '上海浦东国际机场', en: 'Shanghai Pudong International Airport', ko: '상하이 푸둥 국제공항', vi: 'Sân bay quốc tế Phố Đông Thượng Hải' } },
  { keys: ['SHA', 'Hongqiao', 'Hồng Kiều', '虹桥'], names: { zh: '上海虹桥国际机场', en: 'Shanghai Hongqiao International Airport', ko: '상하이 훙차오 국제공항', vi: 'Sân bay quốc tế Hồng Kiều Thượng Hải' } },
  { keys: ['HAN', 'Noi Bai', 'Nội Bài'], names: { zh: '河内内排国际机场', en: 'Noi Bai International Airport', ko: '노이바이 국제공항', vi: 'Sân bay quốc tế Nội Bài' } },
  { keys: ['SGN', 'Tan Son Nhat', 'Tân Sơn Nhất'], names: { zh: '胡志明市新山一国际机场', en: 'Tan Son Nhat International Airport', ko: '떤선녓 국제공항', vi: 'Sân bay quốc tế Tân Sơn Nhất' } },
];
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Airport name in `lang` for what the user typed ("Incheon", "ICN", even a small typo like "Inchoen"). */
export function airportName(typed: string | undefined, lang: UiLang): string | undefined {
  if (!typed?.trim()) return undefined;
  const raw = typed.trim();
  const n = norm(raw.replace(/(international|intl|airport|san bay|sân bay|quoc te|quốc tế|机场|공항|国际)/gi, ''));
  for (const a of AIRPORTS)
    for (const k of a.keys) {
      if (k.length === 3 && /^[A-Z]{3}$/.test(k)) {
        if (raw.toUpperCase() === k || new RegExp(`\\b${k}\\b`).test(raw.toUpperCase())) return a.names[lang];
        continue;
      }
      const nk = norm(k);
      if (n === nk || n.includes(nk) || (nk.length >= 5 && n.length >= 5 && editDistance(n, nk) <= 2)) return a.names[lang];
    }
  return undefined;
}
