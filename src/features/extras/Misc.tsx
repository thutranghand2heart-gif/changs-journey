import { useMemo, useState } from 'react';
import type { FoodEntry, Memory, ThemeId, WalletDoc } from '../../db/schema';
import { updateJourneySettings } from '../../db/repo';
import { Field, go, PageHeader, useStore } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { search } from '../../lib/search';
import { THEMES } from '../../lib/themes';

export function FeatureLibrary() {
  const { journey: j } = useJourney();
  const b = `/j/${j.id}`;
  const groups: [string, [string, string][]][] = [
    ['Kỷ niệm', [['📖 Memory Book', `${b}/memories/book`], ['🖼️ Gallery', `${b}/memories/gallery`], ['⭐ Keepsakes', `${b}/memories/keepsakes`], ['✍️ Viết kỷ niệm', `${b}/memories/new`], ['💌 Bưu thiếp', `${b}/postcards`], ['⏳ Hộp thời gian', `${b}/capsules`], ['✨ Trang kết', `${b}/ending`], ['⬇️ Xuất kỷ niệm', `${b}/export`]]],
    ['Chuyến đi', [['💰 Ngân sách', `${b}/budget`], ['🍜 Food Passport', `${b}/food`], ['🚕 Di chuyển', `${b}/transport`], ['⛅ Thời tiết & trang phục', `${b}/weather`], ['✅ Checklist', `${b}/checklist`], ['🛂 Thẻ nhập cảnh', `${b}/travel-doc`], ['🔎 Tìm kiếm', `${b}/search`]]],
    ['Ngôn ngữ & an toàn', [['🈶 Trợ lý ngôn ngữ', `${b}/language`], ['🆘 Khẩn cấp', `${b}/emergency`]]],
    ['Phép màu', [['🎄 Advent · Quả cầu tuyết · Xe tuần lộc', `${b}/magic`], ['🎨 Giao diện & ảnh nền', `${b}/appearance`]]],
    ['Bảo vệ', [['🔒 Két riêng tư', '/vault'], ['🛡️ Sao lưu & khôi phục', '/backup'], ['📶 Sẵn sàng offline', `/offline?j=${j.id}`]]],
  ];
  return (
    <div className="page">
      <PageHeader title="Thư viện tính năng" back={b} />
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
      <PageHeader title="Tìm kiếm" sub="Tiếng Việt, chữ Hán, pinyin (có hoặc không dấu)" back={`/j/${j.id}`} />
      <input className="search-input" autoFocus placeholder="Tên địa điểm, chữ Hán hoặc pinyin…" value={q} onChange={(e: any) => setQ(e.target.value)} aria-label="Từ khóa" />
      <p className="muted xsmall">Nội dung riêng tư và ngày tự do không xuất hiện trong kết quả.</p>
      <div className="stack-s">
        {hits.map((h) => (
          <button key={h.kind + h.id} className="list-row glass-card" onClick={() => open(h)}>
            <span>{KIND[h.kind]}</span>
            <span className="grow text-left"><b>{h.title}</b><span className="muted xsmall block">{h.snippet}</span></span>
          </button>
        ))}
        {q && !hits.length && <p className="muted center">Không có kết quả.</p>}
      </div>
    </div>
  );
}

export function AppearancePage() {
  const { journey: j } = useJourney();
  const s = j.settings;
  const set = (patch: Partial<typeof s>) => updateJourneySettings(j.id, patch);
  const [custom, setCustom] = useState(s.customColors ?? { bg: '#1d2b3a', accent: '#e0c38c', card: 'rgba(29,43,58,0.6)', text: '#fdf8f0' });
  return (
    <div className="page">
      <PageHeader title="Giao diện" sub={`Chỉ áp dụng cho “${j.title}”`} back={`/j/${j.id}`} />
      <div className="stack">
        <Field label="Chủ đề">
          <div className="theme-picker">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => (
              <button key={k} className={`theme-chip ${s.theme === k ? 'on' : ''}`} style={{ background: THEMES[k].bg2, color: THEMES[k].text, borderColor: THEMES[k].accent }} onClick={() => set({ theme: k as ThemeId })}>{THEMES[k].deco} {THEMES[k].name}</button>
            ))}
            <button className={`theme-chip ${s.theme === 'custom' ? 'on' : ''}`} onClick={() => set({ theme: 'custom', customColors: custom })}>✨ Tùy chỉnh</button>
          </div>
        </Field>
        {s.theme === 'custom' && (
          <div className="card row gap wrap">
            {(['bg', 'accent', 'text'] as const).map((k) => (
              <Field key={k} label={{ bg: 'Nền', accent: 'Nhấn', text: 'Chữ' }[k]}><input type="color" value={custom[k]} onChange={(e: any) => { const c = { ...custom, [k]: e.target.value, card: k === 'bg' ? e.target.value + 'aa' : custom.card }; setCustom(c); set({ customColors: c }); }} /></Field>
            ))}
          </div>
        )}
        <Field label="Kiểu chữ">
          <select value={s.fontStyle} onChange={(e: any) => set({ fontStyle: e.target.value })}><option value="storybook">Storybook (có chân)</option><option value="modern">Hiện đại</option><option value="handwritten">Viết tay</option></select>
        </Field>
        <Field label="Hiệu ứng chuyển động">
          <select value={s.animations} onChange={(e: any) => set({ animations: e.target.value })}><option value="full">Đầy đủ</option><option value="reduced">Nhẹ</option><option value="off">Tắt</option></select>
        </Field>
        <label className="toggle-row"><input type="checkbox" checked={s.openingAnimation} onChange={(e: any) => set({ openingAnimation: e.target.checked })} /> Phần mở đầu khi vào chuyến đi</label>
        <label className="toggle-row"><input type="checkbox" checked={s.decorations} onChange={(e: any) => set({ decorations: e.target.checked })} /> Trang trí (tuyết, đèn, hạt vàng)</label>
        <p className="muted xsmall">Nhạc nền (giai điệu chuông nguyên bản do ứng dụng tự tổng hợp) luôn tắt khi mở ứng dụng và chỉ phát khi bạn bấm nút loa trên Home. Nhạc tự dừng khi đọc phát âm hoặc khi xem giấy tờ.</p>
        <button className="btn" onClick={() => go(`/j/${j.id}/background`)}>🖼️ Ảnh nền cá nhân…</button>
        <button className="btn ghost" onClick={() => go(`/j/${j.id}/edit`)}>✏️ Sửa thông tin chuyến đi</button>
      </div>
    </div>
  );
}
