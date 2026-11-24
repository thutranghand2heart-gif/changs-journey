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

export function FeatureLibrary() {
  const { journey: j } = useJourney();
  const b = `/j/${j.id}`;
  const groups: [string, [string, string][]][] = [
    [t('Kỷ niệm'), [[t('📖 Memory Book'), `${b}/memories/book`], [t('🖼️ Gallery'), `${b}/memories/gallery`], [t('⭐ Keepsakes'), `${b}/memories/keepsakes`], [t('✍️ Viết kỷ niệm'), `${b}/memories/new`], [t('💌 Bưu thiếp'), `${b}/postcards`], [t('⏳ Hộp thời gian'), `${b}/capsules`], [t('✨ Trang kết'), `${b}/ending`], [t('⬇️ Xuất kỷ niệm'), `${b}/export`]]],
    [t('Chuyến đi'), [[t('💰 Ngân sách'), `${b}/budget`], [t('🍜 Food Passport'), `${b}/food`], [t('🚕 Di chuyển'), `${b}/transport`], [t('⛅ Thời tiết & trang phục'), `${b}/weather`], [t('✅ Checklist'), `${b}/checklist`], [t('🛂 Thẻ nhập cảnh'), `${b}/travel-doc`], [t('🔎 Tìm kiếm'), `${b}/search`]]],
    [t('Ngôn ngữ & an toàn'), [[t('🈶 Trợ lý ngôn ngữ'), `${b}/language`], [t('🆘 Khẩn cấp'), `${b}/emergency`], [t('🌐 Dịch nội dung bạn nhập'), `/translate?j=${j.id}`]]],
    [t('Phép màu'), [[t('🎄 Advent · Quả cầu tuyết · Xe tuần lộc'), `${b}/magic`], [t('🎨 Giao diện & ảnh nền'), `${b}/appearance`]]],
    [t('Bảo vệ'), [[t('🔒 Két riêng tư'), '/vault'], [t('🛡️ Sao lưu & khôi phục'), '/backup'], [t('📶 Sẵn sàng offline'), `/offline?j=${j.id}`]]],
  ];
  return (
    <div className="page">
      <PageHeader title={t('Thư viện tính năng')} back={b} />
      {groups.map(([g, items]) => (
        <section key={g} className="glass-card">
          <h3>{g}</h3>
          <div className="menu-list">{items.map(([l, p]) => <button key={p} onClick={() => go(p)}>{l}</button>)}</div>
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
