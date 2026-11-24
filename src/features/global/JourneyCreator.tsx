import { useState } from 'react';
import type { Journey, ThemeId } from '../../db/schema';
import { createJourney, saveFileAsBlob, updateJourneySettings } from '../../db/repo';
import { Field, go, PageHeader, pickFiles, useStore, useToast } from '../../ui/core';
import { THEMES } from '../../lib/themes';
import { addDays } from '../../lib/time';

const TZS = ['Asia/Shanghai', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Hong_Kong', 'Europe/Paris', 'Europe/London', 'America/New_York', 'UTC'];
const CURRENCIES = ['CNY', 'KRW', 'VND', 'JPY', 'USD', 'EUR', 'THB', 'SGD', 'TWD', 'HKD', 'GBP'];
const EMOJI = ['📖', '🌸', '🍁', '🌙', '🏔️', '🏝️', '🗼', '🎐', '🚂', '✨'];

export function JourneyCreator() {
  const journeys = useStore<Journey>('journeys');
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ title: '', destinations: '', startDate: today, endDate: addDays(today, 3), timeZone: 'Asia/Seoul', currency: 'KRW', notes: '', theme: 'sakura-dreams' as ThemeId, coverEmoji: '📖', templateFrom: '' });
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!f.title.trim()) return toast('Hãy đặt tên chuyến đi', 'warn');
    if (f.endDate < f.startDate) return toast('Ngày kết thúc phải sau ngày bắt đầu', 'warn');
    setBusy(true);
    try {
      const j = await createJourney({ ...f, destinations: f.destinations.split(',').map((s) => s.trim()).filter(Boolean), templateFrom: f.templateFrom || undefined });
      if (cover) {
        const rec = await saveFileAsBlob(cover, cover.name, j.id);
        await updateJourneySettings(j.id, { coverBlobId: rec.id });
      }
      toast('Đã tạo chuyến đi');
      go(`/j/${j.id}`);
    } catch (err: any) {
      toast(err.message ?? 'Không thể tạo chuyến đi', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page theme-global">
      <PageHeader title="Chuyến đi mới" back="/" />
      <form className="stack" onSubmit={submit}>
        <Field label="Tên chuyến đi"><input value={f.title} onChange={set('title')} placeholder="VD: Kyoto mùa hoa anh đào" required /></Field>
        <Field label="Điểm đến (quốc gia/thành phố, cách nhau bằng dấu phẩy)"><input value={f.destinations} onChange={set('destinations')} placeholder="Kyoto, Osaka" /></Field>
        <div className="row gap">
          <Field label="Bắt đầu"><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Kết thúc"><input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        </div>
        <div className="row gap">
          <Field label="Múi giờ">
            <select value={f.timeZone} onChange={set('timeZone')}>{TZS.map((z) => <option key={z}>{z}</option>)}</select>
          </Field>
          <Field label="Tiền tệ">
            <select value={f.currency} onChange={set('currency')}>{CURRENCIES.map((z) => <option key={z}>{z}</option>)}</select>
          </Field>
        </div>
        <Field label="Chủ đề">
          <div className="theme-picker">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => (
              <button type="button" key={k} className={`theme-chip ${f.theme === k ? 'on' : ''}`} style={{ background: THEMES[k].bg2, color: THEMES[k].text, borderColor: THEMES[k].accent }} onClick={() => setF({ ...f, theme: k })}>
                {THEMES[k].deco} {THEMES[k].name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Bìa">
          <div className="row wrap gap-s">
            {EMOJI.map((e) => (
              <button type="button" key={e} className={`emoji-chip ${f.coverEmoji === e ? 'on' : ''}`} onClick={() => setF({ ...f, coverEmoji: e })}>{e}</button>
            ))}
            <button type="button" className="btn small" onClick={async () => setCover((await pickFiles('image/*'))[0] ?? null)}>{cover ? `Ảnh: ${cover.name}` : 'Hoặc chọn ảnh bìa…'}</button>
          </div>
        </Field>
        <Field label="Bắt đầu từ" hint="Mẫu chỉ sao chép tiêu đề ngày và khung hoạt động (dạng nháp). Không sao chép giấy tờ, đặt chỗ, thanh toán hay nội dung riêng tư.">
          <select value={f.templateFrom} onChange={set('templateFrom')}>
            <option value="">Lịch trình trống</option>
            {journeys.map((j) => <option key={j.id} value={j.id}>Mẫu từ: {j.title}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú"><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
        <button className="btn primary big" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo chuyến đi'}</button>
      </form>
    </div>
  );
}
