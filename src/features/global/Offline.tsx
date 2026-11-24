import { useEffect, useState } from 'react';
import type { Activity, Day, Journey, WalletDoc } from '../../db/schema';
import * as db from '../../db/idb';
import { readBlob } from '../../db/repo';
import { PageHeader, queryParam } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { PHRASES } from '../../lib/phrases';

type Status = 'ok' | 'missing' | 'warn' | 'na';
interface Row { label: string; status: Status; detail: string }

const SHELL = ['./', './index.html', './app.js', './app.css', './manifest.webmanifest'];

async function check(journeyId: string | null): Promise<Row[]> {
  const rows: Row[] = [];
  // 1. App shell
  if (!('serviceWorker' in navigator)) rows.push({ label: 'Vỏ ứng dụng (offline)', status: 'missing', detail: 'Trình duyệt không hỗ trợ service worker.' });
  else {
    const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
    let cached = 0;
    try {
      for (const u of SHELL) if (await caches.match(new URL(u, location.href).href)) cached++;
    } catch { /* caches unavailable */ }
    const ok = !!reg?.active && cached >= 4;
    rows.push({ label: 'Vỏ ứng dụng đã lưu cache', status: ok ? 'ok' : 'missing', detail: ok ? `Service worker hoạt động · ${cached}/${SHELL.length} tệp lõi trong cache` : `Service worker: ${reg?.active ? 'có' : 'chưa'} · ${cached}/${SHELL.length} tệp lõi trong cache. Hãy mở ứng dụng một lần khi có mạng rồi kiểm tra lại.` });
  }
  // 2. Essential data
  const journeys = journeyId ? [await db.get<Journey>('journeys', journeyId)].filter(Boolean) as Journey[] : await db.getAll<Journey>('journeys');
  for (const j of journeys) {
    const days = await db.getAll<Day>('days', j.id);
    const acts = await db.getAll<Activity>('activities', j.id);
    rows.push({ label: `${j.title}: lịch trình`, status: days.length ? 'ok' : 'missing', detail: `${days.length} ngày · ${acts.length} hoạt động đọc được từ bộ nhớ máy` });
    if (j.hotel) rows.push({ label: `${j.title}: khách sạn`, status: j.hotel.addressZh || j.hotel.addressEn ? 'ok' : 'missing', detail: j.hotel.addressZh ?? j.hotel.addressEn ?? 'thiếu địa chỉ' });
    const docs = await db.getAll<WalletDoc>('docs', j.id);
    const withFile = docs.filter((d) => d.blobId);
    let readable = 0;
    const bad: string[] = [];
    for (const d of withFile) {
      const r = await readBlob(d.blobId!);
      if (r && (r.rec.encrypted || r.blob.size > 0)) readable++;
      else bad.push(d.title || 'riêng tư');
    }
    rows.push({ label: `${j.title}: vé & giấy tờ đã nhập`, status: !withFile.length ? 'warn' : bad.length ? 'missing' : 'ok', detail: !withFile.length ? 'Chưa nhập tệp vé/QR gốc nào.' : bad.length ? `Không đọc được: ${bad.join(', ')}` : `${readable}/${withFile.length} tệp gốc đọc được (${docs.filter((d) => d.lastOpenedOkAt).length} đã từng mở thành công)` });
    const ck = await db.getAll('checklist', j.id);
    rows.push({ label: `${j.title}: checklist`, status: ck.length ? 'ok' : 'warn', detail: `${ck.length} mục` });
  }
  rows.push({ label: 'Câu nói du lịch & khẩn cấp', status: 'ok', detail: `${PHRASES.length} câu đóng gói sẵn trong ứng dụng (cần vỏ ứng dụng đã cache để dùng offline)` });
  rows.push({ label: 'Thông tin khẩn cấp (110 / 120 / 119)', status: 'ok', detail: 'Đóng gói sẵn trong ứng dụng' });
  // 3. Backups
  const s = (await db.get<any>('settings', 'global')) ?? { backups: [] };
  const last = s.backups?.[0];
  rows.push({ label: 'Bản sao lưu đã tạo', status: last ? 'ok' : 'missing', detail: last ? new Date(last.createdAt).toLocaleString('vi-VN') : 'Chưa có' });
  rows.push({ label: 'Bản sao lưu đã lưu ra ngoài', status: last?.saved ? 'ok' : 'missing', detail: last?.saved ? 'Bạn đã xác nhận' : 'Chưa' });
  rows.push({ label: 'Bản sao lưu đã xác minh', status: last?.verified ? 'ok' : 'missing', detail: last?.verified ? 'Đã đọc lại và khớp' : 'Chưa' });
  // 4. Not offline
  for (const x of ['Dẫn đường trực tiếp Amap', 'Thời tiết trực tiếp', 'Tỷ giá trực tuyến', 'Đọc thành tiếng (tùy giọng của iPhone, chưa kiểm chứng offline)']) rows.push({ label: x, status: 'na', detail: 'Không có offline — cần Internet' });
  return rows;
}

export function OfflinePage() {
  const { settings } = useApp();
  const jid = queryParam('j');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const run = () => (setRows(null), check(jid).then(setRows));
  useEffect(() => {
    run();
    const f = () => setOnline(navigator.onLine);
    addEventListener('online', f);
    addEventListener('offline', f);
    return () => (removeEventListener('online', f), removeEventListener('offline', f));
  }, [settings.backups.length]);
  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
  const icon: Record<Status, string> = { ok: '✅', missing: '⛔', warn: '⚠️', na: '🌐' };
  return (
    <div className="page theme-global">
      <PageHeader title="Kiểm tra sẵn sàng offline" sub={online ? 'Đang có mạng' : 'Đang offline'} back={back} right={<button className="btn small" onClick={run}>Kiểm tra lại</button>} />
      <p className="muted small">Một mục chỉ được đánh dấu ✅ khi dữ liệu thật sự có trên máy và đọc được ngay lúc kiểm tra.</p>
      {!rows && <p className="muted">Đang kiểm tra…</p>}
      <div className="stack-s">
        {rows?.map((r, i) => (
          <div key={i} className={`check-item glass-card s-${r.status}`}>
            <span className="check-ic">{icon[r.status]}</span>
            <span className="grow"><b>{r.label}</b><span className="xsmall muted block">{r.detail}</span></span>
          </div>
        ))}
      </div>
      <div className="card small">
        <h4>Giới hạn của iPhone / PWA</h4>
        <ul>
          <li>Ứng dụng phải được mở ít nhất một lần khi có mạng để lưu cache.</li>
          <li>iOS có thể xóa dữ liệu của trang web không được dùng trong thời gian dài; ứng dụng đã “Thêm vào Màn hình chính” thường được giữ lâu hơn nhưng không được bảo đảm.</li>
          <li>Ứng dụng trên Màn hình chính và tab Safari có bộ nhớ riêng biệt.</li>
        </ul>
      </div>
    </div>
  );
}
