import { useState } from 'react';
import { Confirm, PageHeader, Sheet, pickFiles, useToast } from '../../ui/core';
import { ArtImg, useArtwork } from '../../ui/art';
import { GROUP_LABEL, importArtworkPack, removeAllArtwork, replaceAsset, restoreDefault, type ArtAsset, type ArtGroup } from '../../lib/artwork';
import { t } from '../../lib/i18n';

const ORDER: ArtGroup[] = ['tree', 'globe', 'cover', 'page', 'icon', 'frame', 'postcard', 'charm'];

/** Asset Manager: import the private artwork pack, preview each piece on emerald & ivory, replace or restore defaults. */
export function ArtworkPage() {
  const art = useArtwork();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<ArtAsset | null>(null);
  const [wipe, setWipe] = useState(false);
  const list = Object.values(art.assets);
  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/settings'));

  const importPack = async () => {
    const [f] = await pickFiles('.zip,application/zip');
    if (!f) return;
    setBusy(t('Đang nhập…'));
    try {
      const r = await importArtworkPack(f, (d, n) => setBusy(t('Đang nhập {0}/{1}…', d, n)));
      toast(t('Đã nhập {0} artwork mới, cập nhật {1}, giữ {2} ảnh bạn đã thay.', r.added, r.updated, r.keptCustom) + (r.failed.length ? ' ' + t('{0} mục lỗi.', r.failed.length) : ''));
    } catch (e) {
      toast((e as Error).message || t('Không nhập được tệp.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page theme-global">
      <PageHeader title={t('Artwork')} sub={t("Chang's Christmas Collection")} back={back} />
      <div className="stack">
        <section className="card small">
          <p>{t('Artwork được nhập từ gói riêng (.zip) và chỉ lưu trên máy này — không nằm trong mã nguồn công khai hay bản đăng của ứng dụng. Có trong bản sao lưu và dùng được offline.')}</p>
          <div className="row gap-s wrap">
            <button className="btn primary" data-testid="artpack-import" disabled={!!busy} onClick={importPack}>{busy ?? (list.length ? t('Nhập lại / cập nhật gói') : t('Nhập gói artwork'))}</button>
            {list.length > 0 && <button className="btn small ghost" onClick={() => setWipe(true)}>{t('Gỡ toàn bộ artwork')}</button>}
          </div>
          {list.length > 0 && <p className="xsmall muted">{t('{0} artwork trên máy.', list.length)}</p>}
        </section>
        {!list.length && <p className="muted center">{t('Chưa có artwork. Khi chưa nhập, ứng dụng dùng hình vẽ mặc định.')}</p>}
        {ORDER.map((g) => {
          const items = list.filter((a) => a.group === g);
          if (!items.length) return null;
          return (
            <section key={g} className="card">
              <h4>{t(GROUP_LABEL[g])} <span className="muted xsmall">· {items.length}</span></h4>
              <div className="art-grid">
                {items.map((a) => (
                  <button key={a.id} className="art-tile" data-testid="art-tile" onClick={() => setSel(a)}>
                    <ArtImg id={a.id} v="thumb" />
                    <span className="xsmall">{a.name}</span>
                    {a.source === 'custom' && <span className="art-badge">{t('Đã thay')}</span>}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {sel && <AssetSheet a={art.assets[sel.id] ?? sel} onClose={() => setSel(null)} />}
      <Confirm open={wipe} danger title={t('Gỡ toàn bộ artwork?')} body={t('Ứng dụng quay về hình vẽ mặc định. Dữ liệu chuyến đi không bị ảnh hưởng. Bạn có thể nhập lại gói bất cứ lúc nào.')} onConfirm={async () => void (await removeAllArtwork())} onClose={() => setWipe(false)} />
    </div>
  );
}

function AssetSheet({ a, onClose }: { a: ArtAsset; onClose: () => void }) {
  const toast = useToast();
  return (
    <Sheet open onClose={onClose} title={a.name}>
      <div className="stack-s" data-testid="art-sheet">
        <div className="art-preview">
          <div className="on-emerald"><ArtImg id={a.id} /></div>
          <div className="on-ivory"><ArtImg id={a.id} /></div>
        </div>
        <dl className="art-meta small">
          <dt>{t('Mã')}</dt><dd><code>{a.id}</code></dd>
          <dt>{t('Nhóm')}</dt><dd>{t(GROUP_LABEL[a.group])}</dd>
          <dt>{t('Vị trí hiển thị')}</dt><dd>{a.placement}</dd>
          <dt>{t('Kích thước')}</dt><dd>{a.width} × {a.height} · {t('tỷ lệ')} {a.aspect}</dd>
          <dt>{t('Nền trong suốt')}</dt><dd>{a.alpha ? t('Có (đã kiểm tra kênh alpha)') : t('Không — ảnh chữ nhật')}</dd>
          <dt>{t('Trạng thái')}</dt><dd>{a.source === 'custom' ? t('Ảnh bạn đã thay') : t('Mặc định từ gói')}</dd>
          <dt>{t('Quyền riêng tư')}</dt><dd>{t('Chỉ trên máy này')}</dd>
        </dl>
        {a.note && <p className="xsmall muted">{a.id === 'tree' ? t('Ảnh cây thông có quầng nền xanh đậm bán trong suốt — ứng dụng làm mờ nhẹ mép khi hiển thị, không sửa ảnh gốc.') : a.note}</p>}
        <div className="row gap-s wrap">
          <button className="btn small" onClick={async () => { const [f] = await pickFiles('image/*'); if (f) { await replaceAsset(a.id, f); toast(t('Đã thay artwork')); } }}>{t('Thay bằng ảnh của tôi')}</button>
          {a.source === 'custom' && <button className="btn small ghost" onClick={async () => { await restoreDefault(a.id); toast(t('Đã khôi phục mặc định')); }}>{t('Khôi phục mặc định')}</button>}
        </div>
      </div>
    </Sheet>
  );
}
