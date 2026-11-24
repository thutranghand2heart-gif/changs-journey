import { useEffect, useState } from 'react';
import type { Activity, Attachment, Day, Journey } from '../../db/schema';
import * as db from '../../db/idb';
import { readBlob } from '../../db/repo';
import { PageHeader, queryParam } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { PHRASES } from '../../lib/phrases';
import { locale, t } from '../../lib/i18n';

type Status = 'ok' | 'missing' | 'warn' | 'na';
interface Row { label: string; status: Status; detail: string }

const SHELL = ['./', './index.html', './app.js', './app.css', './manifest.webmanifest'];

async function check(journeyId: string | null): Promise<Row[]> {
  const rows: Row[] = [];
  // 1. App shell
  if (!('serviceWorker' in navigator)) rows.push({ label: t('Vỏ ứng dụng (offline)'), status: 'missing', detail: t('Trình duyệt không hỗ trợ service worker.') });
  else {
    const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
    let cached = 0;
    try {
      for (const u of SHELL) if (await caches.match(new URL(u, location.href).href)) cached++;
    } catch { /* caches unavailable */ }
    const ok = !!reg?.active && cached >= 4;
    rows.push({ label: t('Vỏ ứng dụng đã lưu cache'), status: ok ? 'ok' : 'missing', detail: ok ? t('Service worker hoạt động · {0}/{1} tệp lõi trong cache', cached, SHELL.length) : t('Service worker: {0} · {1}/{2} tệp lõi trong cache. Hãy mở ứng dụng một lần khi có mạng rồi kiểm tra lại.', reg?.active ? t('có') : t('chưa'), cached, SHELL.length) });
  }
  // 2. Essential data
  const journeys = journeyId ? [await db.get<Journey>('journeys', journeyId)].filter(Boolean) as Journey[] : await db.getAll<Journey>('journeys');
  for (const j of journeys) {
    const days = await db.getAll<Day>('days', j.id);
    const acts = await db.getAll<Activity>('activities', j.id);
    rows.push({ label: t('{0}: lịch trình', j.title), status: days.length ? 'ok' : 'missing', detail: t('{0} ngày · {1} hoạt động đọc được từ bộ nhớ máy', days.length, acts.length) });
    if (j.hotel) rows.push({ label: t('{0}: khách sạn', j.title), status: j.hotel.addressZh || j.hotel.addressEn ? 'ok' : 'missing', detail: j.hotel.addressZh ?? j.hotel.addressEn ?? t('thiếu địa chỉ') });
    const atts = await db.getAll<Attachment>('attachments', j.id);
    let readable = 0;
    const bad: string[] = [];
    for (const a of atts) {
      const r = await readBlob(a.blobId);
      if (r && (r.rec.encrypted || r.blob.size > 0)) readable++;
      else bad.push(a.label);
    }
    rows.push({ label: t('{0}: vé & giấy tờ đã nhập', j.title), status: !atts.length ? 'warn' : bad.length ? 'missing' : 'ok', detail: !atts.length ? t('Chưa nhập tệp vé/QR gốc nào.') : bad.length ? t('Không đọc được: {0}', bad.join(', ')) : t('{0}/{1} tệp gốc đọc được ({2} đã từng mở thành công)', readable, atts.length, atts.filter((a) => a.lastOpenedOkAt).length) });
    const ck = await db.getAll('checklist', j.id);
    rows.push({ label: `${j.title}: checklist`, status: ck.length ? 'ok' : 'warn', detail: t('{0} mục', ck.length) });
  }
  rows.push({ label: t('Câu nói du lịch & khẩn cấp'), status: 'ok', detail: t('{0} câu đóng gói sẵn trong ứng dụng (cần vỏ ứng dụng đã cache để dùng offline)', PHRASES.length) });
  rows.push({ label: t('Thông tin khẩn cấp (110 / 120 / 119)'), status: 'ok', detail: t('Đóng gói sẵn trong ứng dụng') });
  // 3. Backups
  const s = (await db.get<any>('settings', 'global')) ?? { backups: [] };
  const last = s.backups?.[0];
  rows.push({ label: t('Bản sao lưu đã tạo'), status: last ? 'ok' : 'missing', detail: last ? new Date(last.createdAt).toLocaleString(locale()) : t('Chưa có') });
  rows.push({ label: t('Bản sao lưu đã lưu ra ngoài'), status: last?.saved ? 'ok' : 'missing', detail: last?.saved ? t('Bạn đã xác nhận') : t('Chưa') });
  rows.push({ label: t('Bản sao lưu đã xác minh'), status: last?.verified ? 'ok' : 'missing', detail: last?.verified ? t('Đã đọc lại và khớp') : t('Chưa') });
  // 4. Not offline
  for (const x of [t('Dẫn đường trực tiếp Amap'), t('Thời tiết trực tiếp'), t('Tỷ giá trực tuyến'), t('Đọc thành tiếng (tùy giọng của iPhone, chưa kiểm chứng offline)')]) rows.push({ label: x, status: 'na', detail: t('Không có offline — cần Internet') });
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
      <PageHeader title={t('Kiểm tra sẵn sàng offline')} sub={online ? t('Đang có mạng') : t('Đang offline')} back={back} right={<button className="btn small" onClick={run}>{t('Kiểm tra lại')}</button>} />
      <p className="muted small">{t('Một mục chỉ được đánh dấu ✅ khi dữ liệu thật sự có trên máy và đọc được ngay lúc kiểm tra.')}</p>
      {!rows && <p className="muted">{t('Đang kiểm tra…')}</p>}
      <div className="stack-s">
        {rows?.map((r, i) => (
          <div key={i} className={`check-item glass-card s-${r.status}`}>
            <span className="check-ic">{icon[r.status]}</span>
            <span className="grow"><b>{r.label}</b><span className="xsmall muted block">{r.detail}</span></span>
          </div>
        ))}
      </div>
      <div className="card small">
        <h4>{t('Giới hạn của iPhone / PWA')}</h4>
        <ul>
          <li>{t('Ứng dụng phải được mở ít nhất một lần khi có mạng để lưu cache.')}</li>
          <li>{t('iOS có thể xóa dữ liệu của trang web không được dùng trong thời gian dài; ứng dụng đã “Thêm vào Màn hình chính” thường được giữ lâu hơn nhưng không được bảo đảm.')}</li>
          <li>{t('Ứng dụng trên Màn hình chính và tab Safari có bộ nhớ riêng biệt.')}</li>
        </ul>
      </div>
    </div>
  );
}
