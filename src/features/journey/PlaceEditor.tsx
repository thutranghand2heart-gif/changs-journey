import { useState } from 'react';
import type { Place } from '../../db/schema';
import * as db from '../../db/idb';
import { Field, Sheet, useToast } from '../../ui/core';
import { t } from '../../lib/i18n';

/** Edit an existing place (name, Chinese name, address…). Every activity linked to it shows the change. */
export function PlaceEditor({ place, onClose }: { place: Place; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Place>({ ...place });
  const set = (k: keyof Place) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const clean = (s?: string) => (s?.trim() ? s.trim() : undefined);
    await db.put<Place>('places', { ...f, name: f.name.trim(), city: f.city.trim(), nameZh: clean(f.nameZh), pinyin: clean(f.pinyin), addressZh: clean(f.addressZh), addressEn: clean(f.addressEn), notes: f.notes ?? '' });
    toast(t('Đã lưu địa điểm'));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={t('Sửa địa điểm')} full>
      <div className="stack" data-testid="place-editor">
        <Field label={t('Tên địa điểm')}><input value={f.name} onChange={set('name')} /></Field>
        <div className="row gap">
          <Field label={t('Tên tiếng Trung')}><input lang="zh-CN" value={f.nameZh ?? ''} onChange={set('nameZh')} /></Field>
          <Field label={t('Pinyin')}><input value={f.pinyin ?? ''} onChange={set('pinyin')} /></Field>
        </div>
        <Field label={t('Thành phố')}><input value={f.city} onChange={set('city')} /></Field>
        <Field label={t('Địa chỉ tiếng Trung / địa phương')}><textarea rows={2} lang="zh-CN" value={f.addressZh ?? ''} onChange={set('addressZh')} /></Field>
        <Field label={t('Địa chỉ tiếng Anh')}><textarea rows={2} value={f.addressEn ?? ''} onChange={set('addressEn')} /></Field>
        <Field label={t('Ghi chú')}><textarea rows={3} value={f.notes ?? ''} onChange={set('notes')} /></Field>
        <p className="muted xsmall">{t('Mọi hoạt động dùng địa điểm này sẽ hiện thông tin mới.')}</p>
        <button className="btn primary" disabled={!f.name.trim()} onClick={save}>{t('Lưu')}</button>
      </div>
    </Sheet>
  );
}
