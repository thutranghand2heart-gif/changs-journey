import { useState } from 'react';
import type { BackupLog } from '../../db/schema';
import { getSettings, saveSettings } from '../../db/repo';
import { Confirm, Field, PageHeader, pickFiles, useToast } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { BackupError, packBackup, parseBackup, type ParsedBackup } from '../../lib/backup';
import { collectAll, restoreAsNew, restoreFull, restoreSelective } from '../../lib/backupIo';
import { sha256Hex, isSealed } from '../../lib/crypto';
import { bytes, downloadBlob, nowIso, uid } from '../../lib/util';

export function BackupPage() {
  const { settings } = useApp();
  const toast = useToast();
  const [encrypt, setEncrypt] = useState(true);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [created, setCreated] = useState<{ bytes: Uint8Array; log: BackupLog } | null>(null);
  const [busy, setBusy] = useState('');
  const [askSaved, setAskSaved] = useState(false);
  const [restore, setRestore] = useState<{ parsed: ParsedBackup; hash: string } | null>(null);
  const [needPass, setNeedPass] = useState<Uint8Array | null>(null);
  const [rPass, setRPass] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [fullConfirm, setFullConfirm] = useState(false);
  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

  const updateLog = async (id: string, patch: Partial<BackupLog>) => {
    const s = await getSettings();
    await saveSettings({ backups: s.backups.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const create = async () => {
    setBusy('Đang tạo bản sao lưu…');
    try {
      const data = await collectAll();
      const createdAt = nowIso();
      const { bytes: out, sha256 } = await packBackup(data, createdAt, encrypt ? pass : undefined);
      const fileName = `chang-backup-${createdAt.slice(0, 16).replace(/[:T]/g, '-')}${encrypt ? '-encrypted' : ''}.changbackup`;
      const log: BackupLog = { id: uid('bk'), createdAt, fileName, sha256, encrypted: encrypt, size: out.length };
      const s = await getSettings();
      await saveSettings({ backups: [log, ...s.backups].slice(0, 20) });
      setCreated({ bytes: out, log });
      toast('Đã TẠO bản sao lưu (chưa lưu ra ngoài)');
    } catch (e: any) {
      toast(e.message ?? 'Lỗi tạo bản sao lưu', 'err');
    } finally {
      setBusy('');
      setPass('');
      setPass2('');
    }
  };

  const save = async () => {
    if (!created) return;
    const blob = new Blob([created.bytes as BlobPart], { type: 'application/octet-stream' });
    const file = new File([blob], created.log.fileName, { type: 'application/octet-stream' });
    if ((navigator as any).canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Bản sao lưu Chang' });
      } catch {
        return toast('Đã hủy chia sẻ', 'warn');
      }
    } else downloadBlob(blob, created.log.fileName);
    setAskSaved(true);
  };

  const openFile = async (purpose: 'verify' | 'restore') => {
    const [f] = await pickFiles('.changbackup,application/octet-stream,application/zip,*/*');
    if (!f) return;
    const raw = new Uint8Array(await f.arrayBuffer());
    const hash = await sha256Hex(raw);
    if (purpose === 'verify') {
      const log = settings.backups.find((b) => b.sha256 === hash);
      try {
        if (isSealed(raw)) {
          setNeedPass(raw);
          setRestore(null);
          if (!log) toast('Tệp không khớp bản sao lưu nào đã tạo trên máy này — vẫn có thể kiểm tra nội dung', 'warn');
          return;
        }
        const parsed = await parseBackup(raw);
        if (log && parsed.integrityOk) {
          await updateLog(log.id, { verified: nowIso(), saved: log.saved ?? nowIso() });
          toast('ĐÃ XÁC MINH: tệp đã lưu khớp và đọc được đầy đủ');
        } else toast(parsed.integrityOk ? 'Tệp đọc được nhưng không khớp nhật ký trên máy này' : `Lỗi toàn vẹn: ${parsed.problems.length} vấn đề`, parsed.integrityOk ? 'warn' : 'err');
        setRestore({ parsed, hash });
      } catch (e: any) {
        toast(e.message, 'err');
      }
      return;
    }
    if (isSealed(raw)) return setNeedPass(raw);
    try {
      setRestore({ parsed: await parseBackup(raw), hash });
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  const unlockFile = async () => {
    if (!needPass) return;
    setBusy('Đang giải mã…');
    try {
      const parsed = await parseBackup(needPass, rPass);
      const hash = await sha256Hex(needPass);
      const log = settings.backups.find((b) => b.sha256 === hash);
      if (log && parsed.integrityOk) {
        await updateLog(log.id, { verified: nowIso(), saved: log.saved ?? nowIso() });
        toast('ĐÃ XÁC MINH bản sao lưu đã mã hóa');
      }
      setRestore({ parsed, hash });
      setNeedPass(null);
    } catch (e: any) {
      toast(e instanceof BackupError ? e.message : 'Không mở được tệp', 'err');
    } finally {
      setBusy('');
      setRPass('');
    }
  };

  const p = restore?.parsed;
  return (
    <div className="page theme-global">
      <PageHeader title="Trung tâm bảo vệ kỷ niệm" sub="Sao lưu · xác minh · khôi phục" back={back} />
      <div className="card small">
        <p>Dữ liệu chỉ nằm trong bộ nhớ trình duyệt của iPhone. Nó <b>có thể mất</b> khi bạn xóa ứng dụng khỏi Màn hình chính, xóa dữ liệu Safari, đổi máy hoặc khi iOS dọn bộ nhớ. Hãy lưu bản sao lưu vào Tệp / iCloud Drive.</p>
      </div>

      <section className="glass-card stack">
        <h3>1 · Tạo bản sao lưu</h3>
        <p className="small muted">Gồm mọi chuyến đi, hoạt động, địa điểm, chi phí, kỷ niệm, giao diện, ảnh nền, ảnh và tệp gốc (vé, QR). Nội dung riêng tư vẫn ở dạng đã mã hóa.</p>
        <label className="toggle-row"><input type="checkbox" checked={encrypt} onChange={(e: any) => setEncrypt(e.target.checked)} /> Mã hóa toàn bộ tệp sao lưu (khuyên dùng)</label>
        {encrypt && (
          <>
            <Field label="Mật khẩu sao lưu"><input type="password" autoComplete="new-password" value={pass} onChange={(e: any) => setPass(e.target.value)} /></Field>
            <Field label="Nhập lại"><input type="password" autoComplete="new-password" value={pass2} onChange={(e: any) => setPass2(e.target.value)} /></Field>
            <p className="warn-box xsmall">Quên mật khẩu này = không thể khôi phục bản sao lưu. Không ai lấy lại được.</p>
          </>
        )}
        <button className="btn primary" disabled={!!busy || (encrypt && (pass.length < 6 || pass !== pass2))} onClick={create}>{busy || 'Tạo bản sao lưu'}</button>
        {created && (
          <div className="card">
            <p>✓ <b>Đã tạo</b>: {created.log.fileName} · {bytes(created.log.size)}</p>
            <button className="btn" onClick={save}>2 · Lưu ra ngoài (Tệp / iCloud / AirDrop)…</button>
          </div>
        )}
      </section>

      <section className="glass-card stack">
        <h3>3 · Xác minh bản đã lưu</h3>
        <p className="small muted">Chọn lại chính tệp bạn đã lưu. Ứng dụng đọc toàn bộ, so mã SHA-256 và kiểm tra từng tệp đính kèm. Chỉ khi đó mới đánh dấu “Đã xác minh”.</p>
        <button className="btn" onClick={() => openFile('verify')}>Chọn tệp để xác minh…</button>
      </section>

      <section className="glass-card stack">
        <h3>4 · Khôi phục</h3>
        <button className="btn" onClick={() => openFile('restore')}>Chọn tệp sao lưu…</button>
      </section>

      {needPass && (
        <section className="glass-card stack">
          <h3>Tệp đã mã hóa</h3>
          <Field label="Mật khẩu sao lưu"><input type="password" value={rPass} onChange={(e: any) => setRPass(e.target.value)} /></Field>
          <button className="btn primary" disabled={!rPass || !!busy} onClick={unlockFile}>{busy || 'Mở tệp'}</button>
        </section>
      )}

      {p && (
        <section className="glass-card stack" aria-label="Xem trước khôi phục">
          <h3>Xem trước khôi phục</h3>
          <p className="small">Tạo lúc {new Date(p.manifest.createdAt).toLocaleString('vi-VN')} · định dạng v{p.manifest.formatVersion}</p>
          <p className={p.integrityOk ? 'ok-text' : 'error'}>{p.integrityOk ? '✓ Toàn vẹn: mọi tệp khớp mã kiểm tra' : `⚠︎ ${p.problems.length} vấn đề toàn vẹn`}</p>
          {!p.integrityOk && <ul className="xsmall">{p.problems.slice(0, 8).map((x) => <li key={x}>{x}</li>)}</ul>}
          {p.manifest.journeys.map((jr) => (
            <div key={jr.id} className="list-row">
              <label className="toggle-row grow"><input type="checkbox" checked={sel.includes(jr.id)} onChange={(e: any) => setSel(e.target.checked ? [...sel, jr.id] : sel.filter((x) => x !== jr.id))} /> <span><b>{jr.title}</b><span className="xsmall muted block">{jr.counts.activities ?? 0} hoạt động · {jr.counts.memories ?? 0} kỷ niệm · {jr.counts.docs ?? 0} giấy tờ · {jr.counts.blobs ?? 0} tệp</span></span></label>
              <button className="btn small" onClick={async () => { await restoreAsNew(p.data, jr.id); toast(`Đã khôi phục “${jr.title}” thành chuyến đi mới`); }}>Thành chuyến mới</button>
            </div>
          ))}
          <div className="row gap wrap">
            <button className="btn" disabled={!sel.length} onClick={async () => { await restoreSelective(p.data, sel); toast('Đã khôi phục các chuyến đã chọn (bản trùng được thêm dưới dạng bản sao)'); }}>Khôi phục chọn lọc ({sel.length})</button>
            <button className="btn danger ghost" onClick={() => setFullConfirm(true)}>Khôi phục toàn bộ (thay thế)…</button>
          </div>
          <p className="muted xsmall">Khôi phục không bao giờ âm thầm ghi đè. Chỉ “toàn bộ” mới thay thế dữ liệu hiện có.</p>
        </section>
      )}

      <section className="glass-card">
        <h3>Nhật ký sao lưu</h3>
        {!settings.backups.length && <p className="muted small">Chưa có bản sao lưu nào.</p>}
        {settings.backups.map((b) => (
          <div key={b.id} className="backup-row small">
            <b>{b.fileName}</b> <span className="muted">{bytes(b.size)}</span>
            <div className="badges">
              <span className="badge on">Đã tạo {new Date(b.createdAt).toLocaleString('vi-VN')}</span>
              <span className={`badge ${b.saved ? 'on' : ''}`}>{b.saved ? `Đã lưu (bạn xác nhận) ${new Date(b.saved).toLocaleDateString('vi-VN')}` : 'Chưa lưu'}</span>
              <span className={`badge ${b.verified ? 'ok' : ''}`}>{b.verified ? `Đã xác minh ${new Date(b.verified).toLocaleDateString('vi-VN')}` : 'Chưa xác minh'}</span>
            </div>
          </div>
        ))}
      </section>

      <Confirm open={askSaved} title="Bạn đã lưu tệp chưa?" body="Trình duyệt không thể biết tệp đã thực sự được lưu ở đâu. Chỉ xác nhận nếu bạn thấy tệp trong Tệp / iCloud Drive." confirmText="Có, tôi đã lưu" onConfirm={async () => { await updateLog(created!.log.id, { saved: nowIso() }); toast('Đã đánh dấu “Đã lưu”. Hãy xác minh ở bước 3.'); }} onClose={() => setAskSaved(false)} />
      <Confirm open={fullConfirm} danger typed="KHÔI PHỤC" title="Thay thế toàn bộ dữ liệu?" body="Mọi dữ liệu hiện có trên máy sẽ bị XÓA và thay bằng nội dung bản sao lưu (kể cả cài đặt Két). Không thể hoàn tác." confirmText="Thay thế toàn bộ" onConfirm={async () => { await restoreFull(p!.data); toast('Đã khôi phục toàn bộ'); location.hash = '#/'; }} onClose={() => setFullConfirm(false)} />
    </div>
  );
}
