// Interface strings for the four supported languages. Vietnamese is the default
// and the fallback; travel content itself stays as authored.
export type Lang = 'vi' | 'zh' | 'en' | 'ko';
type Dict = Record<string, string>;

const vi: Dict = {
  // English-named features get a Vietnamese label so the vi interface never mixes languages (V1.2.1)
  'Food Passport': 'Hộ chiếu ẩm thực', Checklist: 'Danh sách chuẩn bị', Storybook: 'Sách nhật ký', 'Memory Book': 'Sổ kỷ niệm', Gallery: 'Thư viện ảnh', 'My Travel World': 'Thế giới du lịch của tôi', Keepsakes: 'Kỷ vật',
  appName: 'Những bước chân của Chang', subtitle: 'Every step has a story.', addJourney: 'Thêm chuyến đi', myJourneys: 'Hành trình của tôi',
  home: 'Trang chủ', journey: 'Hành trình', map: 'Bản đồ', pose: 'Tạo dáng', wallet: 'Ví', library: 'Thư viện tính năng', search: 'Tìm kiếm',
  back: 'Quay lại', save: 'Lưu', cancel: 'Hủy', delete: 'Xóa', edit: 'Sửa', close: 'Đóng', copy: 'Sao chép', copied: 'Đã sao chép',
  today: 'Hôm nay', settings: 'Cài đặt', archived: 'Đã lưu trữ', menu: 'Menu', documents: 'Giấy tờ', budget: 'Ngân sách', memories: 'Kỷ niệm',
};
const zh: Dict = {
  appName: 'Những bước chân của Chang', subtitle: 'Every step has a story.', addJourney: '添加旅程', myJourneys: '我的旅程',
  home: '首页', journey: '行程', map: '地图', pose: '姿势', wallet: '钱包', library: '功能库', search: '搜索',
  back: '返回', save: '保存', cancel: '取消', delete: '删除', edit: '编辑', close: '关闭', copy: '复制', copied: '已复制',
  today: '今天', settings: '设置', archived: '已归档', menu: '菜单', documents: '证件', budget: '预算', memories: '回忆',
};
const en: Dict = {
  appName: 'Những bước chân của Chang', subtitle: 'Every step has a story.', addJourney: 'Add journey', myJourneys: 'My journeys',
  home: 'Home', journey: 'Journey', map: 'Map', pose: 'Pose', wallet: 'Wallet', library: 'Feature Library', search: 'Search',
  back: 'Back', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close', copy: 'Copy', copied: 'Copied',
  today: 'Today', settings: 'Settings', archived: 'Archived', menu: 'Menu', documents: 'Documents', budget: 'Budget', memories: 'Memories',
};
const ko: Dict = {
  appName: 'Những bước chân của Chang', subtitle: 'Every step has a story.', addJourney: '여행 추가', myJourneys: '나의 여행',
  home: '홈', journey: '일정', map: '지도', pose: '포즈', wallet: '지갑', library: '기능 라이브러리', search: '검색',
  back: '뒤로', save: '저장', cancel: '취소', delete: '삭제', edit: '편집', close: '닫기', copy: '복사', copied: '복사됨',
  today: '오늘', settings: '설정', archived: '보관됨', menu: '메뉴', documents: '서류', budget: '예산', memories: '추억',
};
const KEYED: Record<Lang, Dict> = { vi, zh, en, ko };

// Full interface dictionaries, keyed by the Vietnamese source text. Bundled → available offline.
import enDict from '../i18n/en.json';
import zhDict from '../i18n/zh.json';
import koDict from '../i18n/ko.json';
const DICTS: Record<Exclude<Lang, 'vi'>, Dict> = { en: enDict as Dict, zh: zhDict as Dict, ko: koDict as Dict };

let lang: Lang = 'vi';
export const setLang = (l: Lang) => (lang = l);
export const getLang = () => lang;

/**
 * Translate interface text. `s` is the Vietnamese source string (or a short key such as 'home').
 * `{0}`, `{1}` … are replaced by args. Missing translation → Vietnamese original (never invented).
 * User content (notes, diary, names, addresses, booking refs) must NEVER be passed through t().
 */
export function t(s: string, ...args: (string | number | undefined)[]): string {
  let out = (lang !== 'vi' ? DICTS[lang][s] : undefined) ?? KEYED[lang][s] ?? KEYED.vi[s] ?? s;
  if (args.length) out = out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
  return out;
}
/** Marks module-level strings for extraction; translate them at render time with t(). */
export const tr = (s: string) => s;

export const LANG_NAMES: Record<Lang, string> = { vi: 'Tiếng Việt', zh: '简体中文', en: 'English', ko: '한국어' };
export const LOCALES: Record<Lang, string> = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US', ko: 'ko-KR' };
export const locale = () => LOCALES[lang];
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(LOCALES[lang]);
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[lang]);

/** Localized record text: user-supplied translation if present, else the original field. */
export function loc<T extends { i18n?: Partial<Record<Lang, Record<string, string | undefined>>> }>(rec: T, field: 'title' | 'subtitle' | 'description', original: string | undefined): string | undefined {
  return rec.i18n?.[lang]?.[field] || original;
}
