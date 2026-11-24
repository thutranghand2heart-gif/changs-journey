import { useMemo, useState } from 'react';
import { LuCopy, LuNavigation, LuFootprints, LuPlus, LuStar } from 'react-icons/lu';
import type { Place } from '../../db/schema';
import { db } from '../../db/repo';
import { Field, go, PageHeader, queryParam, Sheet, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { copyText, nowIso, uid } from '../../lib/util';
import { amapUrl } from '../../lib/maps';
import { t } from '../../lib/i18n';
import { OriginalToggle, Tx } from '../../ui/contentTx';

export function MapTab() {
  const { journey: j, places, activities } = useJourney();
  const toast = useToast();
  const cities = useMemo(() => Array.from(new Set(places.map((p) => p.city))), [places]);
  const focus = queryParam('p');
  const [city, setCity] = useState<string>(() => places.find((p) => p.id === focus)?.city ?? cities[0] ?? '');
  const [sel, setSel] = useState<string | null>(focus);
  const [adding, setAdding] = useState(false);
  const inCity = places.filter((p) => p.city === city);
  const selected = places.find((p) => p.id === sel);
  const actsAt = (pid: string) => activities.filter((a) => a.placeId === pid);

  // schematic projection of approximate coordinates into the card
  const pts = inCity.filter((p) => p.lat != null && p.lng != null);
  const box = pts.length
    ? { minLat: Math.min(...pts.map((p) => p.lat!)), maxLat: Math.max(...pts.map((p) => p.lat!)), minLng: Math.min(...pts.map((p) => p.lng!)), maxLng: Math.max(...pts.map((p) => p.lng!)) }
    : null;
  const proj = (p: Place) => {
    if (!box) return { x: 50, y: 50 };
    const sx = box.maxLng - box.minLng || 0.01;
    const sy = box.maxLat - box.minLat || 0.01;
    return { x: 12 + ((p.lng! - box.minLng) / sx) * 76, y: 88 - ((p.lat! - box.minLat) / sy) * 76 };
  };

  const stamp = async (p: Place) => {
    await db.put('places', { ...p, visitedAt: p.visitedAt ? undefined : nowIso() });
    toast(p.visitedAt ? t('Đã bỏ dấu chân') : t('Đã đóng dấu chân 👣'));
  };

  return (
    <div className="page">
      <PageHeader title={t('Map')} sub={t('Bản đồ minh họa · vị trí gần đúng')} right={<button className="icon-btn" aria-label={t('Thêm nơi muốn đến')} onClick={() => setAdding(true)}><LuPlus size={20} /></button>} />
      <div className="seg scroll-x">
        {cities.map((c) => <button key={c} className={c === city ? 'on' : ''} onClick={() => setCity(c)}>{c}</button>)}
      </div>
      <div className="story-map glass-card" role="img" aria-label={t('Bản đồ minh họa {0}', city)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="story-map-bg" aria-hidden="true">
          <path d="M0 70 C20 60 35 80 55 66 S85 50 100 58 L100 100 L0 100 Z" fill="currentColor" opacity="0.06" />
          <path d="M0 30 C30 40 50 20 100 35" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="1.5 2" fill="none" strokeWidth="0.5" />
        </svg>
        {inCity.map((p) => {
          const { x, y } = proj(p);
          const st = p.visitedAt ? 'visited' : p.wishlist ? 'wish' : 'planned';
          return (
            <button key={p.id} className={`map-pin ${st} ${sel === p.id ? 'on' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => setSel(p.id)} aria-label={p.name}>
              <span className="pin-dot">{p.visitedAt ? '👣' : p.wishlist ? '★' : ''}</span>
              <span className="pin-label">{p.nameZh ?? p.name}</span>
            </button>
          );
        })}
      </div>
      <p className="muted xsmall">{t('● dự kiến · 👣 đã đến (bạn tự đóng dấu) · ★ muốn đến. Không theo dõi vị trí. Dẫn đường trực tiếp cần Internet qua Amap.')}</p>

      <h3 className="section-title">{t('Địa điểm & địa chỉ (dùng được offline)')}</h3>
      <div className="stack-s">
        {inCity.map((p) => (
          <div key={p.id} className={`place-row glass-card ${sel === p.id ? 'on' : ''}`}>
            <button className="grow text-left" onClick={() => setSel(p.id)}>
              <b><Tx s="places" r={p} f="name" /></b> {p.visitedAt && <span title={t('đã đến')}>👣</span>} {p.wishlist && <LuStar size={12} />}
              {p.nameZh && <div className="zh small" lang="zh-CN">{p.nameZh}{p.pinyin ? ` · ${p.pinyin}` : ''}</div>}
              {p.addressZh && <div className="zh xsmall muted" lang="zh-CN">{p.addressZh}</div>}
            </button>
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onClose={() => setSel(null)} title={selected ? <Tx s="places" r={selected} f="name" /> : undefined}>
        {selected && (
          <div className="stack">
            {selected.nameZh && <p className="zh big-zh" lang="zh-CN">{selected.nameZh}</p>}
            {selected.addressZh && <p className="zh selectable" lang="zh-CN">{selected.addressZh}</p>}
            {selected.addressEn && <p className="small muted">{selected.addressEn}</p>}
            <OriginalToggle s="places" r={selected} fields={['name', 'notes']} />
            {selected.notes && <p className="small">📝 <Tx s="places" r={selected} f="notes" /></p>}
            <div className="row gap-s wrap">
              {selected.addressZh && <button className="btn small" onClick={async () => toast((await copyText(selected.addressZh!)) ? t('Đã sao chép địa chỉ') : t('Không sao chép được'), 'ok')}><LuCopy size={14} /> {' '}{t('Sao chép địa chỉ')}</button>}
              <a className="btn small" href={amapUrl(selected)} target="_blank" rel="noopener noreferrer"><LuNavigation size={14} /> {' '}{t('Amap 高德')}</a>
              <button className="btn small ghost" onClick={() => stamp(selected)}><LuFootprints size={14} /> {selected.visitedAt ? t('Bỏ dấu chân') : t('Đóng dấu đã đến')}</button>
            </div>
            {actsAt(selected.id).length > 0 && (
              <div className="card">
                <h4>{t('Hoạt động tại đây')}</h4>
                {actsAt(selected.id).map((a) => (
                  <button key={a.id} className="list-row" onClick={() => go(`/j/${j.id}/journey/${a.dayId}?a=${a.id}`)}>{a.start ?? '—'} · <Tx s="activities" r={a} f="title" /></button>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
      {adding && <AddWish onClose={() => setAdding(false)} city={city} />}
    </div>
  );
}

function AddWish({ onClose, city }: { onClose: () => void; city: string }) {
  const { journey: j, places } = useJourney();
  const toast = useToast();
  const [f, setF] = useState({ name: '', nameZh: '', addressZh: '', city });
  return (
    <Sheet open onClose={onClose} title={t('Thêm nơi muốn đến')}>
      <div className="stack">
        <Field label={t('Tên')}><input value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('Tên tiếng Trung')}><input value={f.nameZh} onChange={(e: any) => setF({ ...f, nameZh: e.target.value })} /></Field>
        <Field label={t('Địa chỉ tiếng Trung')}><input value={f.addressZh} onChange={(e: any) => setF({ ...f, addressZh: e.target.value })} /></Field>
        <Field label={t('Thành phố')}><input value={f.city} onChange={(e: any) => setF({ ...f, city: e.target.value })} /></Field>
        <button
          className="btn primary"
          disabled={!f.name.trim()}
          onClick={async () => {
            const dup = places.find((p) => [p.name, p.nameZh, ...p.aliases].includes(f.name.trim()) || (!!f.nameZh && p.nameZh === f.nameZh.trim()));
            if (dup) {
              await db.put('places', { ...dup, wishlist: true });
              toast(t('Đã có “{0}” — đánh dấu muốn đến', dup.name));
            } else {
              await db.put('places', { id: uid('pl'), journeyId: j.id, name: f.name.trim(), nameZh: f.nameZh || undefined, addressZh: f.addressZh || undefined, city: f.city || t('Khác'), aliases: [], wishlist: true, notes: '' } satisfies Place);
              toast(t('Đã thêm'));
            }
            onClose();
          }}
        >
          {t('Lưu')}</button>
      </div>
    </Sheet>
  );
}
