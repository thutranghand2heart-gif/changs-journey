import { useMemo, useState } from 'react';
import type { FoodEntry, Memory, ThemeId, WalletDoc } from '../../db/schema';
import { db, saveFileAsBlob, updateJourneySettings } from '../../db/repo';
import { Confirm, Field, go, PageHeader, pickFiles, useBlobUrl, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { search } from '../../lib/search';
import { THEMES } from '../../lib/themes';
import { LanguageList } from '../../ui/Language';
import { t } from '../../lib/i18n';
import { useCt } from '../../ui/contentTx';
import { ArtIcon, useArtUrl } from '../../ui/art';
import { LuBookHeart, LuImages, LuBookOpen, LuFrame, LuGift, LuPenLine, LuMail, LuHourglass, LuSparkles, LuDownload, LuUtensils, LuReceipt, LuPlane, LuTrainFront, LuCloudSun, LuListChecks, LuLanguages, LuPhone, LuGlobe, LuSearch, LuSnowflake, LuPalette, LuImage, LuLock, LuArchive, LuWifiOff } from 'react-icons/lu';

type Feat = [label: string, path: string, art: string | null, Icon: any];
export function FeatureLibrary() {
  const { journey: j } = useJourney();
  const b = `/j/${j.id}`;
  const xmas = j.settings.theme === 'christmas-emerald';
  const groups: [string, Feat[]][] = [
    [t('Kỷ niệm & câu chuyện'), [
      [t('Memory Book'), `${b}/memories/book`, 'memory', LuBookHeart], [t('Gallery'), `${b}/memories/gallery`, 'gallery', LuImages], [t('Storybook'), `${b}/storybook`, 'home', LuBookOpen],
      [t('Khung ảnh kỷ niệm'), `${b}/frames`, null, LuFrame], [t('Keepsakes'), `${b}/memories/keepsakes`, 'keepsakes', LuGift], [t('Viết kỷ niệm'), `${b}/memories/new`, null, LuPenLine],
      [t('Bưu thiếp'), `${b}/postcards`, null, LuMail], [t('Hộp thời gian'), `${b}/capsules`, null, LuHourglass], [t('Trang kết'), `${b}/ending`, null, LuSparkles], [t('Xuất kỷ niệm'), `${b}/export`, null, LuDownload],
    ]],
    [t('Ẩm thực & trải nghiệm'), [[t('Food Passport'), `${b}/food`, 'food', LuUtensils], [t('Ngân sách'), `${b}/budget`, null, LuReceipt]]],
    [t('Hành trang du lịch'), [
      [t('Thẻ nhập cảnh'), `${b}/travel-doc`, 'flight', LuPlane], [t('Di chuyển'), `${b}/transport`, 'train', LuTrainFront], [t('Thời tiết & trang phục'), `${b}/weather`, null, LuCloudSun],
      [t('Checklist'), `${b}/checklist`, null, LuListChecks], [t('Trợ lý ngôn ngữ'), `${b}/language`, null, LuLanguages], [t('Khẩn cấp'), `${b}/emergency`, null, LuPhone],
      [t('Dịch nội dung bạn nhập'), `/translate?j=${j.id}`, null, LuGlobe], [t('Tìm kiếm'), `${b}/search`, null, LuSearch],
    ]],
    [t('Phép màu Giáng sinh'), [[t('Advent · Quả cầu tuyết · Xe tuần lộc'), `${b}/magic`, 'globe', LuSnowflake], [t('Giao diện & ảnh nền'), `${b}/appearance`, null, LuPalette], [t('Artwork'), '/artwork', null, LuImage]]],
    [t('Riêng tư & bảo vệ'), [[t('Két riêng tư'), '/vault', 'vault', LuLock], [t('Sao lưu & khôi phục'), '/backup', 'backup', LuArchive], [t('Sẵn sàng offline'), `/offline?j=${j.id}`, null, LuWifiOff]]],
  ];
  return (
    <div className="page">
      <PageHeader title={t('Thư viện tính năng')} back={b} />
      {groups.map(([g, items]) => (
        <section key={g} className="glass-card">
          <h3>{g}</h3>
          <div className="feat-grid">
            {items.map(([l, p, art, Icon]) => (
              <button key={p} className="feat" onClick={() => go(p)}>
                <span className="feat-ic">{xmas && art ? <ArtIcon id={art} size={44} fallback={<Icon size={22} />} /> : <Icon size={22} />}</span>
                <span className="feat-l">{l}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SearchPage() {
  const { journey: j, days, activities, places } = useJourney();
  const food = useStore<FoodEntry>('food', j.id);
  const memories = useStore<Memory>('memories', j.id);
  const docs = useStore<WalletDoc>('docs', j.id);
  const [q, setQ] = useState('');
  const hits = useMemo(() => search({ days, activities, places, food, memories, docs }, q), [q, days, activities, places, food, memories, docs]);
  const open = (h: (typeof hits)[number]) => {
    const b = `/j/${j.id}`;
    if (h.kind === 'activity') go(`${b}/journey/${h.dayId}?a=${h.id}`);
    else if (h.kind === 'day') go(`${b}/journey/${h.id}`);
    else if (h.kind === 'place') go(`${b}/map?p=${h.id}`);
    else if (h.kind === 'food') go(`${b}/food`);
    else if (h.kind === 'memory') go(`${b}/memories/${h.id}`);
    else go(`${b}/wallet?d=${h.id}`);
  };
  const KIND: Record<string, string> = { activity: '🗓️', day: '📖', place: '📍', food: '🍜', memory: '💭', document: '📄' };
  return (
    <div className="page">
      <PageHeader title={t('Tìm kiếm')} sub={t('Tiếng Việt, chữ Hán, pinyin (có hoặc không dấu)')} back={`/j/${j.id}`} />
      <input className="search-input" autoFocus placeholder={t('Tên địa điểm, chữ Hán hoặc pinyin…')} value={q} onChange={(e: any) => setQ(e.target.value)} aria-label={t('Từ khóa')} />
      <p className="muted xsmall">{t('Nội dung riêng tư và ngày tự do không xuất hiện trong kết quả.')}</p>
      <div className="stack-s">
        {hits.map((h) => (
          <button key={h.kind + h.id} className="list-row glass-card" onClick={() => open(h)}>
            <span>{KIND[h.kind]}</span>
            <span className="grow text-left"><b>{h.title}</b><span className="muted xsmall block">{h.snippet}</span></span>
          </button>
        ))}
        {q && !hits.length && <p className="muted center">{t('Không có kết quả.')}</p>}
      </div>
    </div>
  );
}

export function AppearancePage() {
  const { journey: j } = useJourney();
  const ct = useCt();
  const s = j.settings;
  const set = (patch: Partial<typeof s>) => updateJourneySettings(j.id, patch);
  const [custom, setCustom] = useState(s.customColors ?? { bg: '#1d2b3a', accent: '#e0c38c', card: 'rgba(29,43,58,0.6)', text: '#fdf8f0' });
  return (
    <div className="page">
      <PageHeader title={t('Giao diện')} sub={t('Chỉ áp dụng cho “{0}”', ct('journeys', j, 'title'))} back={`/j/${j.id}`} />
      <div className="stack">
        <section className="card">
          <h4>🌐 {t('Ngôn ngữ giao diện')}</h4>
          <LanguageList />
          <p className="muted xsmall">{t('Áp dụng cho toàn bộ ứng dụng.')}</p>
        </section>
        <Field label={t('Chủ đề')}>
          <div className="theme-picker">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => (
              <button key={k} className={`theme-chip ${s.theme === k ? 'on' : ''}`} style={{ background: THEMES[k].bg2, color: THEMES[k].text, borderColor: THEMES[k].accent }} onClick={() => set({ theme: k as ThemeId })}>{THEMES[k].deco} {THEMES[k].name}</button>
            ))}
            <button className={`theme-chip ${s.theme === 'custom' ? 'on' : ''}`} onClick={() => set({ theme: 'custom', customColors: custom })}>{t('✨ Tùy chỉnh')}</button>
          </div>
        </Field>
        {s.theme === 'custom' && (
          <div className="card row gap wrap">
            {(['bg', 'accent', 'text'] as const).map((k) => (
              <Field key={k} label={{ bg: t('Nền'), accent: t('Nhấn'), text: t('Chữ') }[k]}><input type="color" value={custom[k]} onChange={(e: any) => { const c = { ...custom, [k]: e.target.value, card: k === 'bg' ? e.target.value + 'aa' : custom.card }; setCustom(c); set({ customColors: c }); }} /></Field>
            ))}
          </div>
        )}
        <StickerSettings />
        {j.settings.theme === 'christmas-emerald' && <TreePlacement />}
        <button className="btn small" onClick={() => go('/artwork')}>{t('Artwork (Christmas Collection)')}</button>
        <Field label={t('Kiểu chữ')}>
          <select value={s.fontStyle} onChange={(e: any) => set({ fontStyle: e.target.value })}><option value="storybook">{t('Storybook (có chân)')}</option><option value="modern">{t('Hiện đại')}</option><option value="handwritten">{t('Viết tay')}</option></select>
        </Field>
        <Field label={t('Hiệu ứng chuyển động')}>
          <select value={s.animations} onChange={(e: any) => set({ animations: e.target.value })}><option value="full">{t('Đầy đủ')}</option><option value="reduced">{t('Nhẹ')}</option><option value="off">{t('Tắt')}</option></select>
        </Field>
        <label className="toggle-row"><input type="checkbox" checked={s.openingAnimation} onChange={(e: any) => set({ openingAnimation: e.target.checked })} /> {' '}{t('Phần mở đầu khi vào chuyến đi')}</label>
        <label className="toggle-row"><input type="checkbox" checked={s.decorations} onChange={(e: any) => set({ decorations: e.target.checked })} /> {' '}{t('Trang trí (tuyết, đèn, hạt vàng)')}</label>
        <p className="muted xsmall">{t('Nhạc nền (giai điệu chuông nguyên bản do ứng dụng tự tổng hợp) luôn tắt khi mở ứng dụng và chỉ phát khi bạn bấm nút loa trên Home. Nhạc tự dừng khi đọc phát âm hoặc khi xem giấy tờ.')}</p>
        <button className="btn" onClick={() => go(`/j/${j.id}/background`)}>{t('🖼️ Ảnh nền cá nhân…')}</button>
        <button className="btn ghost" onClick={() => go(`/j/${j.id}/edit`)}>{t('✏️ Sửa thông tin chuyến đi')}</button>
      </div>
    </div>
  );
}

/** Personal countdown sleigh sticker: imported from the device, stored as the original file in IndexedDB only. */
function StickerSettings() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const id = j.settings.countdownStickerBlobId;
  const { url } = useBlobUrl(id);
  const [del, setDel] = useState(false);
  const pick = async () => {
    const [f] = await pickFiles('image/png,image/webp,image/*');
    if (!f) return;
    const rec = await saveFileAsBlob(f, f.name, j.id); // original bytes, unchanged
    await updateJourneySettings(j.id, { countdownStickerBlobId: rec.id });
    if (id) await db.del('blobs', id);
    toast(t('Đã lưu nhãn dán trên máy này'));
  };
  return (
    <section className="card" data-testid="sticker-settings">
      <h4>{t('🛷 Nhãn dán đếm ngược')}</h4>
      <p className="muted xsmall">{t('Ảnh PNG nền trong suốt dùng làm nút kéo của thanh đếm ngược. Ảnh giữ nguyên như bạn nhập, chỉ lưu trên máy (có trong bản sao lưu), không tải lên đâu cả.')}</p>
      {url && <div className="sticker-preview"><img src={url} alt="" /></div>}
      <div className="row gap-s wrap">
        <button className="btn small" data-testid="sticker-import" onClick={pick}>{id ? t('Thay ảnh') : t('Nhập ảnh')}</button>
        {id && <button className="btn small ghost" onClick={() => setDel(true)}>{t('Gỡ ảnh')}</button>}
      </div>
      <Confirm open={del} title={t('Gỡ nhãn dán?')} body={t('Thanh đếm ngược sẽ dùng hình mặc định. Ảnh sẽ bị xóa khỏi máy này (bản sao lưu cũ vẫn còn).')} onConfirm={async () => { await updateJourneySettings(j.id, { countdownStickerBlobId: undefined }); if (id) await db.del('blobs', id); }} onClose={() => setDel(false)} />
    </section>
  );
}

/** Position & size of the official tree artwork on this journey's Home (does not edit the image). */
function TreePlacement() {
  const { journey: j } = useJourney();
  const url = useArtUrl('tree', 'thumb');
  if (!url) return null;
  const ta = j.settings.treeArt ?? {};
  const set = (k: 'scale' | 'dx' | 'dy', v: number) => updateJourneySettings(j.id, { treeArt: { ...ta, [k]: v } });
  return (
    <section className="card" data-testid="tree-placement">
      <h4>{t('🎄 Cây thông trên trang chủ')}</h4>
      <label className="small">{t('Kích thước')} <input type="range" min="0.7" max="1.35" step="0.05" value={ta.scale ?? 1} onChange={(e: any) => set('scale', +e.target.value)} /></label>
      <label className="small">{t('Ngang')} <input type="range" min="-30" max="20" step="1" value={ta.dx ?? 0} onChange={(e: any) => set('dx', +e.target.value)} /></label>
      <label className="small">{t('Dọc')} <input type="range" min="-15" max="25" step="1" value={ta.dy ?? 0} onChange={(e: any) => set('dy', +e.target.value)} /></label>
      <button className="btn small ghost" onClick={() => updateJourneySettings(j.id, { treeArt: {} })}>{t('Đặt lại')}</button>
    </section>
  );
}
