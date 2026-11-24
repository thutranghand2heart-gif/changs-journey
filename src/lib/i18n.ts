// Interface strings for the four supported languages. Vietnamese is the default
// and the fallback; travel content itself stays as authored.
export type Lang = 'vi' | 'zh' | 'en' | 'ko';
type Dict = Record<string, string>;

const vi: Dict = {
  appName: 'Những bước chân của Chang', subtitle: 'Every step has a story.', addJourney: 'Thêm chuyến đi', myJourneys: 'Hành trình của tôi',
  home: 'Home', journey: 'Journey', map: 'Map', pose: 'Pose', wallet: 'Wallet', library: 'Thư viện tính năng', search: 'Tìm kiếm',
  back: 'Quay lại', save: 'Lưu', cancel: 'Hủy', delete: 'Xóa', edit: 'Sửa', close: 'Đóng', copy: 'Sao chép', copied: 'Đã sao chép',
  today: 'Hôm nay', settings: 'Cài đặt', archived: 'Đã lưu trữ', menu: 'Menu', documents: 'Giấy tờ', budget: 'Ngân sách', memories: 'Kỷ niệm',
};
const zh: Dict = {
  appName: 'Chang 的足迹', subtitle: 'Every step has a story.', addJourney: '添加旅程', myJourneys: '我的旅程',
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
  appName: '창의 발자국', subtitle: 'Every step has a story.', addJourney: '여행 추가', myJourneys: '나의 여행',
  home: '홈', journey: '일정', map: '지도', pose: '포즈', wallet: '지갑', library: '기능 라이브러리', search: '검색',
  back: '뒤로', save: '저장', cancel: '취소', delete: '삭제', edit: '편집', close: '닫기', copy: '복사', copied: '복사됨',
  today: '오늘', settings: '설정', archived: '보관됨', menu: '메뉴', documents: '서류', budget: '예산', memories: '추억',
};
const D: Record<Lang, Dict> = { vi, zh, en, ko };
let lang: Lang = 'vi';
export const setLang = (l: Lang) => (lang = l);
export const getLang = () => lang;
export const t = (k: string) => D[lang][k] ?? vi[k] ?? k;
export const LANG_NAMES: Record<Lang, string> = { vi: 'Tiếng Việt', zh: '简体中文', en: 'English', ko: '한국어' };
