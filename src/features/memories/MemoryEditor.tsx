import { useEffect, useRef, useState } from 'react';
import { LuImage, LuLock, LuBold, LuItalic, LuStar } from 'react-icons/lu';
import type { Memory } from '../../db/schema';
import { db, saveFileAsBlob } from '../../db/repo';
import { BlobImg, Confirm, Field, go, PageHeader, pickFiles, queryParam, useLive, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { nowIso, uid } from '../../lib/util';
import { encryptBlob, makeMemoryPublic, readPrivateMemory, saveEncryptedMemory, vaultUnlocked } from '../../lib/vault';
import { Markup, useVaultOpen } from './MemoryCommon';

const DRAFT_KEY = (id: string) => `chang-draft-${id}`;

export function MemoryEditorPage({ memoryId }: { memoryId?: string }) {
  const { journey: j, days } = useJourney();
  const [existing, loaded] = useLive(() => (memoryId ? db.get<Memory>('memories', memoryId) : Promise.resolve(undefined)), [memoryId], undefined as Memory | undefined);
  if (memoryId && !loaded) return <div className="page muted">Đang mở…</div>;
  if (memoryId && !existing) return <div className="page"><PageHeader title="Không tìm thấy" back={`/j/${j.id}/memories`} /></div>;
  const dayParam = queryParam('day') ?? undefined;
  const day = days.find((d) => d.id === dayParam);
  const fresh: Memory = {
    id: uid('m'), journeyId: j.id, dayId: dayParam, title: '', body: '', layout: 'classic', photoBlobIds: [], keepsake: false,
    privacy: queryParam('private') === '1' || day?.privateByDefault ? 'private' : 'normal', createdAt: nowIso(), updatedAt: nowIso(),
  };
  return <Editor key={memoryId ?? 'new'} initial={existing ?? fresh} isNew={!existing} />;
}

function Editor({ initial, isNew }: { initial: Memory; isNew: boolean }) {
  const { journey: j, days } = useJourney();
  const toast = useToast();
  const vaultOpen = useVaultOpen();
  const [m, setM] = useState<Memory>(initial);
  const [text, setText] = useState<{ title: string; body: string } | null>(initial.encrypted ? null : { title: initial.title, body: initial.body });
  const [preview, setPreview] = useState(false);
  const [del, setDel] = useState(false);
  const ta = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (initial.encrypted && vaultOpen) readPrivateMemory(initial).then(setText).catch(() => toast('Không giải mã được', 'err'));
  }, [vaultOpen]);
  // offline draft autosave (plain drafts only; private drafts are never written unencrypted)
  useEffect(() => {
    if (isNew && m.privacy !== 'private') {
      const d = localStorage.getItem(DRAFT_KEY(j.id));
      if (d) try { const p = JSON.parse(d); setText(p); } catch { /* ignore */ }
    }
  }, []);
  useEffect(() => {
    if (!text || m.privacy === 'private') return;
    try { localStorage.setItem(isNew ? DRAFT_KEY(j.id) : DRAFT_KEY(m.id), JSON.stringify(text)); } catch { /* storage full or blocked */ }
  }, [text]);

  if (m.encrypted && !text)
    return (
      <div className="page">
        <PageHeader title="Kỷ niệm riêng tư" back={`/j/${j.id}/memories`} />
        <p>🔒 Nội dung đã được mã hóa. Mở khóa Két để đọc và sửa.</p>
        <button className="btn" onClick={() => go('/vault')}>Mở Két riêng tư</button>
      </div>
    );

  const wrap = (mark: string) => {
    const el = ta.current;
    if (!el || !text) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const body = text.body.slice(0, s) + mark + text.body.slice(s, e) + mark + text.body.slice(e);
    setText({ ...text, body });
  };

  const save = async () => {
    if (!text) return;
    try {
      let rec: Memory = { ...m, title: text.title, body: text.body, updatedAt: nowIso() };
      if (m.privacy === 'private') {
        if (!vaultUnlocked()) {
          toast('Cần mở khóa Két để lưu nội dung riêng tư (mã hóa)', 'warn');
          return go('/vault');
        }
        for (const id of rec.photoBlobIds) await encryptBlob(id);
        rec = await saveEncryptedMemory(rec, text);
      } else if (initial.encrypted) {
        rec = await makeMemoryPublic({ ...initial, photoBlobIds: m.photoBlobIds });
        rec = { ...rec, ...text, dayId: m.dayId, layout: m.layout, keepsake: m.keepsake };
      }
      await db.put('memories', rec);
      try { localStorage.removeItem(DRAFT_KEY(isNew ? j.id : m.id)); } catch { /* */ }
      toast(m.privacy === 'private' ? 'Đã lưu (đã mã hóa)' : 'Đã lưu kỷ niệm');
      go(`/j/${j.id}/memories/${rec.id}`);
    } catch (e: any) {
      toast(e.message ?? 'Không lưu được', 'err');
    }
  };

  return (
    <div className="page">
      <PageHeader title={isNew ? 'Kỷ niệm mới' : 'Sửa kỷ niệm'} back={`/j/${j.id}/memories`} right={<button className="btn small primary" onClick={save}>Lưu</button>} />
      <div className="stack">
        <Field label="Tiêu đề"><input value={text!.title} onChange={(e: any) => setText({ ...text!, title: e.target.value })} placeholder="Một khoảnh khắc…" /></Field>
        <div className="row gap">
          <Field label="Ngày">
            <select value={m.dayId ?? ''} onChange={(e: any) => setM({ ...m, dayId: e.target.value || undefined })}>
              <option value="">—</option>
              {days.map((d) => <option key={d.id} value={d.id}>Ngày {d.index}</option>)}
            </select>
          </Field>
          <Field label="Bố cục">
            <select value={m.layout} onChange={(e: any) => setM({ ...m, layout: e.target.value })}>
              <option value="classic">Cổ điển</option><option value="polaroid">Polaroid</option><option value="letter">Lá thư</option><option value="scrapbook">Scrapbook</option>
            </select>
          </Field>
        </div>
        <div className="toolbar">
          <button className="icon-btn" aria-label="In đậm" onClick={() => wrap('**')}><LuBold size={18} /></button>
          <button className="icon-btn" aria-label="In nghiêng" onClick={() => wrap('_')}><LuItalic size={18} /></button>
          <button className="btn small ghost" onClick={() => setPreview(!preview)}>{preview ? 'Viết' : 'Xem trước'}</button>
        </div>
        {preview ? <Markup className={`memory-body layout-${m.layout} card`} text={text!.body} /> : <textarea ref={ta} rows={10} className="journal-area" value={text!.body} onChange={(e: any) => setText({ ...text!, body: e.target.value })} placeholder="Hôm nay…" />}
        <div className="thumb-row">
          {m.photoBlobIds.map((id) => (
            <div key={id} className="thumb-wrap">
              <BlobImg id={id} className="thumb" />
              <button className="mini danger" aria-label="Bỏ ảnh" onClick={() => setM({ ...m, photoBlobIds: m.photoBlobIds.filter((x) => x !== id) })}>×</button>
            </div>
          ))}
        </div>
        <button className="btn small" onClick={async () => {
          const fs = await pickFiles('image/*', true);
          try {
            const ids: string[] = [];
            for (const f of fs) ids.push((await saveFileAsBlob(f, f.name, j.id)).id);
            setM((cur) => ({ ...cur, photoBlobIds: [...cur.photoBlobIds, ...ids] }));
          } catch (e: any) { toast(e.message, 'err'); }
        }}><LuImage size={14} /> Thêm ảnh</button>
        <label className="toggle-row"><input type="checkbox" checked={m.keepsake} onChange={(e: any) => setM({ ...m, keepsake: e.target.checked })} /> <LuStar size={14} /> Cất vào tủ Keepsakes</label>
        <label className="toggle-row">
          <input type="checkbox" checked={m.privacy === 'private'} onChange={(e: any) => setM({ ...m, privacy: e.target.checked ? 'private' : 'normal' })} />
          <LuLock size={14} /> Riêng tư — mã hóa bằng mật khẩu Két, ẩn khỏi tìm kiếm, xem trước và xuất bản
        </label>
        {m.privacy === 'private' && !vaultOpen && <p className="warn-box small">Két đang khóa. Hãy <button className="link-btn" onClick={() => go('/vault')}>mở Két</button> trước khi lưu.</p>}
        {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>Xóa kỷ niệm</button>}
      </div>
      <Confirm open={del} danger title="Xóa kỷ niệm này?" body="Ảnh đính kèm vẫn được giữ lại trong bộ nhớ nếu được dùng ở nơi khác." onConfirm={async () => (await db.del('memories', m.id), go(`/j/${j.id}/memories`))} onClose={() => setDel(false)} />
    </div>
  );
}
