import { useState } from 'react';
import type { Journey } from '../../db/schema';
import { deleteJourney, updateJourney } from '../../db/repo';
import { Confirm, Field, go, PageHeader, queryParam, Sheet, useStore, useToast } from '../../ui/core';
import { tokensFor } from '../../lib/themes';
import { fold } from '../../lib/util';
import { t } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

export function Library() {
  const journeys = useStore<Journey>('journeys');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(queryParam('f') ?? 'active');
  const [sel, setSel] = useState<Journey | null>(null);
  const [edit, setEdit] = useState<Journey | null>(null);
  const [del, setDel] = useState<Journey | null>(null);

  const list = journeys
    .filter((j) => (filter === 'archived' ? j.archived : filter === 'pinned' ? j.pinned && !j.archived : filter === 'all' ? true : !j.archived))
    .filter((j) => !q || fold(j.title + ' ' + j.destinations.join(' ')).includes(fold(q)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="page theme-global">
      <PageHeader title={t('Thư viện hành trình')} sub={t('Kệ sách những chuyến đi')} back="/" />
      <input className="search-input" placeholder={t('Tìm chuyến đi…')} value={q} onChange={(e: any) => setQ(e.target.value)} />
      <div className="seg">
        {[['active', t('Đang dùng')], ['pinned', t('Đã ghim')], ['archived', t('Lưu trữ')], ['all', t('Tất cả')]].map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="bookshelf">
        {list.map((j) => {
          const tk = tokensFor(j);
          return (
            <button key={j.id} className="book-spine" style={{ background: `linear-gradient(90deg, ${tk.bg}, ${tk.bg2} 30%, ${tk.bg})`, color: tk.text, borderColor: tk.accent }} onClick={() => setSel(j)}>
              <span className="spine-emoji">{j.coverEmoji}</span>
              <span className="spine-title"><Tx s="journeys" r={j} f="title" /></span>
              <span className="spine-year">{j.startDate.slice(0, 4)}</span>
              {j.archived && <span className="spine-tag">{t('lưu trữ')}</span>}
            </button>
          );
        })}
        <div className="shelf-board" />
      </div>
      {!list.length && <p className="muted center">{t('Không có chuyến đi phù hợp.')}</p>}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.title}>
        {sel && (
          <div className="menu-list">
            <button onClick={() => go(`/j/${sel.id}`)}>{t('📖 Mở chuyến đi')}</button>
            <button onClick={() => (setEdit(sel), setSel(null))}>{t('✏️ Sửa thông tin / đổi tên')}</button>
            <button onClick={async () => (await updateJourney(sel.id, { pinned: !sel.pinned }), setSel(null), toast(sel.pinned ? t('Đã bỏ ghim') : t('Đã ghim')))}>📌 {sel.pinned ? t('Bỏ ghim') : t('Ghim')}</button>
            <button onClick={async () => (await updateJourney(sel.id, { archived: !sel.archived }), setSel(null), toast(sel.archived ? t('Đã bỏ lưu trữ') : t('Đã lưu trữ (không xóa)')))}>🗄️ {sel.archived ? t('Bỏ lưu trữ') : t('Lưu trữ')}</button>
            <button className="danger-text" onClick={() => (setDel(sel), setSel(null))}>{t('🗑️ Xóa vĩnh viễn…')}</button>
          </div>
        )}
      </Sheet>
      {edit && <EditJourney j={edit} onClose={() => setEdit(null)} />}
      <Confirm
        open={!!del}
        danger
        title={t('Xóa vĩnh viễn?')}
        typed={del?.title}
        body={<p>{t('Toàn bộ ngày, hoạt động, giấy tờ, ảnh, kỷ niệm và chi phí của “')}{del?.title}{t('” sẽ bị xóa khỏi thiết bị này. Lưu trữ thì không xóa — hãy cân nhắc lưu trữ thay vì xóa. Nên tạo bản sao lưu trước.')}</p>}
        confirmText={t('Xóa vĩnh viễn')}
        onConfirm={async () => {
          await deleteJourney(del!.id);
          toast(t('Đã xóa chuyến đi'));
        }}
        onClose={() => setDel(null)}
      />
    </div>
  );
}

export function EditJourney({ j, onClose }: { j: Journey; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: j.title, subtitle: j.subtitle ?? '', destinations: j.destinations.join(', '), notes: j.notes, timeZone: j.timeZone, currency: j.currency, coverEmoji: j.coverEmoji });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet open onClose={onClose} title={t('Sửa thông tin chuyến đi')}>
      <div className="stack">
        <Field label={t('Tên')}><input value={f.title} onChange={set('title')} /></Field>
        <Field label={t('Phụ đề')}><input value={f.subtitle} onChange={set('subtitle')} /></Field>
        <Field label={t('Điểm đến')}><input value={f.destinations} onChange={set('destinations')} /></Field>
        <div className="row gap">
          <Field label={t('Múi giờ')}><input value={f.timeZone} onChange={set('timeZone')} /></Field>
          <Field label={t('Tiền tệ')}><input value={f.currency} onChange={set('currency')} maxLength={3} /></Field>
        </div>
        <Field label={t('Biểu tượng bìa')}><input value={f.coverEmoji} onChange={set('coverEmoji')} maxLength={4} /></Field>
        <Field label={t('Ghi chú')}><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
        <p className="muted small">{t('Ngày của chuyến đi được quản lý trong tab Journey (thêm/xóa ngày) để không làm xáo trộn lịch trình.')}</p>
        <button
          className="btn primary"
          onClick={async () => {
            await updateJourney(j.id, { ...f, currency: f.currency.toUpperCase(), destinations: f.destinations.split(',').map((s) => s.trim()).filter(Boolean) });
            toast(t('Đã lưu'));
            onClose();
          }}
        >
          {t('Lưu')}</button>
      </div>
    </Sheet>
  );
}
