import { useState } from 'react';
import type { BackgroundSetting, Journey } from '../../db/schema';
import { BlobImg, Field, PageHeader, pickFiles, useToast } from '../../ui/core';
import { saveFileAsBlob, saveSettings, updateJourneySettings } from '../../db/repo';
import { useApp } from '../../ui/app-context';

export function BgLayer({ bg }: { bg: BackgroundSetting }) {
  return (
    <div className="bg-layer" aria-hidden="true">
      <BlobImg
        id={bg.blobId}
        className="bg-img"
        style={{ objectPosition: `${bg.posX}% ${bg.posY}%`, transform: `scale(${bg.zoom})`, transformOrigin: `${bg.posX}% ${bg.posY}%`, filter: bg.blur ? `blur(${bg.blur}px)` : undefined }}
      />
      <div className="bg-dim" style={{ background: `rgba(5,18,14,${bg.darken})` }} />
    </div>
  );
}

export const PAGE_KEYS: Record<string, string> = { home: 'Home của chuyến đi', journey: 'Journey', map: 'Map', pose: 'Pose', wallet: 'Wallet' };

/** Background editor for global Home (journey undefined) or a journey page. */
export function BackgroundEditor({ journey, pageKey = 'home', back }: { journey?: Journey; pageKey?: string; back: string }) {
  const { settings } = useApp();
  const toast = useToast();
  const current = journey ? journey.settings.backgrounds[pageKey] : settings.homeBackground;
  const [draft, setDraft] = useState<BackgroundSetting | undefined>(current);
  const [key, setKey] = useState(pageKey);

  const save = async (v: BackgroundSetting | undefined) => {
    if (journey) await updateJourneySettings(journey.id, { backgrounds: { ...journey.settings.backgrounds, [key]: v } });
    else await saveSettings({ homeBackground: v });
    toast(v ? 'Đã lưu ảnh nền' : 'Đã khôi phục nền gốc');
  };
  const upload = async () => {
    const [f] = await pickFiles('image/*');
    if (!f) return;
    try {
      const rec = await saveFileAsBlob(f, f.name, journey?.id);
      setDraft({ blobId: rec.id, posX: 50, posY: 50, zoom: 1, darken: 0.35, blur: 0 });
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };
  const slider = (label: string, k: keyof BackgroundSetting, min: number, max: number, step: number) =>
    draft && (
      <Field label={`${label}: ${draft[k]}`}>
        <input type="range" min={min} max={max} step={step} value={draft[k] as number} onChange={(e: any) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
      </Field>
    );

  return (
    <div className="page">
      <PageHeader title="Ảnh nền cá nhân" sub={journey ? journey.title : 'Trang chủ toàn cục'} back={back} />
      {journey && (
        <Field label="Áp dụng cho">
          <select value={key} onChange={(e: any) => (setKey(e.target.value), setDraft(journey.settings.backgrounds[e.target.value]))}>
            {Object.entries(PAGE_KEYS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="bg-preview">
        {draft ? <BgLayer bg={draft} /> : <div className="bg-preview-empty">Nền gốc</div>}
        {journey?.settings.theme === 'christmas-emerald' && key === 'home' && <div className="bg-preview-tree">🎄 Cây thông vẫn hiển thị phía trên ảnh</div>}
      </div>
      <div className="stack">
        <button className="btn" onClick={upload}>Chọn ảnh…</button>
        {slider('Vị trí ngang (%)', 'posX', 0, 100, 1)}
        {slider('Vị trí dọc (%)', 'posY', 0, 100, 1)}
        {slider('Phóng to / cắt', 'zoom', 1, 2.5, 0.05)}
        {slider('Độ tối', 'darken', 0, 0.8, 0.05)}
        {slider('Độ mờ (px)', 'blur', 0, 12, 1)}
        <div className="row gap">
          <button className="btn ghost" onClick={() => (setDraft(undefined), save(undefined))}>Khôi phục nền gốc</button>
          <button className="btn primary" disabled={!draft} onClick={() => save(draft)}>Lưu</button>
        </div>
        {journey && key === 'home' && <RotateEditor journey={journey} />}
        <p className="muted small">Ảnh gốc được lưu nguyên vẹn trong bộ nhớ của ứng dụng và có trong bản sao lưu.</p>
      </div>
    </div>
  );
}

function RotateEditor({ journey }: { journey: Journey }) {
  const ids = journey.settings.rotateBackgrounds;
  const add = async () => {
    const fs = await pickFiles('image/*', true);
    const recs = [];
    for (const f of fs) recs.push(await saveFileAsBlob(f, f.name, journey.id));
    await updateJourneySettings(journey.id, { rotateBackgrounds: [...ids, ...recs.map((r) => r.id)] });
  };
  return (
    <div className="card">
      <h3>Đổi ảnh nền theo ngày (tùy chọn)</h3>
      <p className="muted small">Nếu có ảnh ở đây, Home sẽ dùng ảnh thứ N cho ngày thứ N của chuyến đi (thay cho ảnh nền chính).</p>
      <div className="thumb-row">
        {ids.map((id, i) => (
          <div key={id} className="thumb-wrap">
            <BlobImg id={id} className="thumb" />
            <span className="badge">N{i + 1}</span>
            <button className="mini danger" aria-label="Bỏ ảnh" onClick={() => updateJourneySettings(journey.id, { rotateBackgrounds: ids.filter((x) => x !== id) })}>×</button>
          </div>
        ))}
      </div>
      <button className="btn small" onClick={add}>Thêm ảnh…</button>
    </div>
  );
}
