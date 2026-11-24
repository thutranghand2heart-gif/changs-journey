import { useEffect, useState } from 'react';
import { LuLock, LuLockOpen } from 'react-icons/lu';
import { Field, PageHeader, useToast } from '../../ui/core';
import { lockVault, setupVault, unlockVault, vaultConfigured } from '../../lib/vault';
import { useVaultOpen } from '../memories/MemoryCommon';

export function VaultPage() {
  const toast = useToast();
  const open = useVaultOpen();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => void vaultConfigured().then(setConfigured), [open]);
  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

  return (
    <div className="page theme-global">
      <PageHeader title="Két riêng tư" back={back} />
      <div className="card small stack-s">
        <p><b>Cách Két hoạt động (trung thực):</b></p>
        <ul>
          <li>Nội dung đánh dấu riêng tư (chữ và ảnh) được <b>mã hóa AES-GCM 256-bit</b>, khóa sinh từ mật khẩu bằng PBKDF2-SHA256 (310.000 vòng) qua Web Crypto của trình duyệt.</li>
          <li>Mật khẩu <b>không được lưu</b> ở bất kỳ đâu. Nếu quên mật khẩu, nội dung riêng tư <b>không thể khôi phục</b> — kể cả từ bản sao lưu.</li>
          <li>Khi Két mở, nội dung giải mã nằm trong bộ nhớ của ứng dụng; ai cầm iPhone đang mở ứng dụng có thể xem. Két tự khóa khi tải lại ứng dụng.</li>
          <li>Một số thông tin phụ (ngày tạo, ngày liên kết, số lượng ảnh) không được mã hóa.</li>
          <li>Face ID chưa được hỗ trợ trong bản này.</li>
        </ul>
      </div>
      {configured === false && (
        <div className="stack">
          <h3>Thiết lập Két</h3>
          <Field label="Mật khẩu (ít nhất 6 ký tự)"><input type="password" autoComplete="new-password" value={p1} onChange={(e: any) => setP1(e.target.value)} /></Field>
          <Field label="Nhập lại"><input type="password" autoComplete="new-password" value={p2} onChange={(e: any) => setP2(e.target.value)} /></Field>
          <button className="btn primary" disabled={busy || p1.length < 6 || p1 !== p2} onClick={async () => {
            setBusy(true);
            try { await setupVault(p1); setConfigured(true); toast('Đã tạo Két và mở khóa'); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); setP1(''); setP2(''); }
          }}>Tạo Két</button>
          {p1 && p2 && p1 !== p2 && <p className="error small">Hai mật khẩu chưa khớp.</p>}
        </div>
      )}
      {configured && !open && (
        <div className="stack">
          <p><LuLock /> Két đang <b>khóa</b>.</p>
          <Field label="Mật khẩu"><input type="password" autoComplete="current-password" value={p1} onChange={(e: any) => setP1(e.target.value)} /></Field>
          <button className="btn primary" disabled={busy || !p1} onClick={async () => {
            setBusy(true);
            const ok = await unlockVault(p1).catch(() => false);
            setBusy(false);
            setP1('');
            toast(ok ? 'Đã mở khóa' : 'Sai mật khẩu', ok ? 'ok' : 'err');
          }}>{busy ? 'Đang kiểm tra…' : 'Mở khóa'}</button>
        </div>
      )}
      {configured && open && (
        <div className="stack">
          <p className="ok-text"><LuLockOpen /> Két đang <b>mở</b> trong phiên này.</p>
          <button className="btn" onClick={() => (lockVault(), toast('Đã khóa Két'))}>Khóa ngay</button>
        </div>
      )}
    </div>
  );
}
