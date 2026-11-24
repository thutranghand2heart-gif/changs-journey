import { useState } from 'react';
import { LuPlus, LuStar } from 'react-icons/lu';
import type { Expense, FoodEntry } from '../../db/schema';
import { db, saveFileAsBlob } from '../../db/repo';
import { BlobImg, Confirm, Field, go, PageHeader, pickFiles, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { fmtMoney, nowIso, uid } from '../../lib/util';

export function FoodPassport() {
  const { journey: j } = useJourney();
  const food = useStore<FoodEntry>('food', j.id);
  const [edit, setEdit] = useState<FoodEntry | null>(null);
  const cities = Array.from(new Set([...j.destinations, ...food.map((f) => f.city)]));
  return (
    <div className="page">
      <PageHeader title="Food Passport" sub="Hộ chiếu ẩm thực" back={`/j/${j.id}`} right={<button className="icon-btn" aria-label="Thêm món" onClick={() => setEdit({ id: uid('f'), journeyId: j.id, city: j.destinations[0] ?? '', dish: '', currency: j.currency, notes: '', photoBlobIds: [], stamped: false, createdAt: nowIso() })}><LuPlus size={20} /></button>} />
      {cities.map((c) => {
        const list = food.filter((f) => f.city === c);
        return (
          <section key={c} className="passport-page glass-card">
            <h3 className="display">{c}</h3>
            <div className="stamps">
              {list.map((f) => (
                <button key={f.id} className={`stamp ${f.stamped ? 'stamped' : ''}`} onClick={() => setEdit(f)}>
                  {f.photoBlobIds[0] ? <BlobImg id={f.photoBlobIds[0]} className="stamp-img" /> : <span className="stamp-emoji">🍜</span>}
                  <span className="stamp-name">{f.dish}</span>
                  {f.rating ? <span className="xsmall">{'★'.repeat(f.rating)}</span> : null}
                </button>
              ))}
              {!list.length && <p className="muted small">Chưa có món nào. Món chỉ được ghi khi bạn tự thêm.</p>}
            </div>
          </section>
        );
      })}
      {edit && <FoodEditor f={edit} isNew={!food.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function FoodEditor({ f: init, isNew, onClose }: { f: FoodEntry; isNew: boolean; onClose: () => void }) {
  const { journey: j } = useJourney();
  const toast = useToast();
  const expenses = useStore<Expense>('expenses', j.id);
  const [f, setF] = useState(init);
  const [del, setDel] = useState(false);
  const set = (k: keyof FoodEntry) => (e: any) => setF({ ...f, [k]: e.target.value });
  const createExpense = async () => {
    if (!f.price) return toast('Nhập giá trước', 'warn');
    const id = uid('e');
    await db.put('expenses', { id, journeyId: j.id, title: f.dish || 'Ăn uống', category: 'food', currency: f.currency, payments: [{ id: uid('p'), amount: f.price, kind: 'payment', date: nowIso() }], receiptBlobIds: [], notes: 'Tạo từ Food Passport', createdAt: nowIso() } satisfies Expense);
    setF({ ...f, expenseId: id });
    toast('Đã tạo 1 chi phí trong Ngân sách (một bản ghi duy nhất)');
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Món mới' : f.dish} full>
      <div className="stack">
        <Field label="Món"><input value={f.dish} onChange={set('dish')} /></Field>
        <div className="row gap">
          <Field label="Thành phố"><input value={f.city} onChange={set('city')} /></Field>
          <Field label="Quán / nơi ăn"><input value={f.place ?? ''} onChange={set('place')} /></Field>
        </div>
        <Field label="Địa chỉ"><input value={f.address ?? ''} onChange={set('address')} /></Field>
        <div className="row gap">
          <Field label={`Giá (${f.currency})`}><input inputMode="decimal" value={f.price ?? ''} onChange={(e: any) => setF({ ...f, price: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Đánh giá">
            <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} sao`} className={n <= (f.rating ?? 0) ? 'on' : ''} onClick={() => setF({ ...f, rating: n })}><LuStar size={20} /></button>)}</div>
          </Field>
        </div>
        <Field label="Ghi chú"><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
        <div className="thumb-row">{f.photoBlobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
        <button className="btn small" onClick={async () => {
          const fs = await pickFiles('image/*', true);
          const ids: string[] = [];
          for (const x of fs) ids.push((await saveFileAsBlob(x, x.name, j.id)).id);
          setF({ ...f, photoBlobIds: [...f.photoBlobIds, ...ids] });
        }}>Thêm ảnh</button>
        <label className="toggle-row"><input type="checkbox" checked={f.stamped} onChange={(e: any) => setF({ ...f, stamped: e.target.checked })} /> Đóng dấu “đã thưởng thức” 🍜</label>
        <Field label="Liên kết chi phí (tùy chọn)">
          <select value={f.expenseId ?? ''} onChange={(e: any) => setF({ ...f, expenseId: e.target.value || undefined })}>
            <option value="">— Không —</option>
            {expenses.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
        {!f.expenseId && <button className="btn small ghost" onClick={createExpense}>Ghi giá này vào Ngân sách</button>}
        {f.expenseId && <button className="link-btn" onClick={() => go(`/j/${j.id}/budget?e=${f.expenseId}`)}>→ Xem chi phí liên kết {f.price ? `(${fmtMoney(f.price, f.currency)})` : ''}</button>}
        <div className="row gap">
          {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>Xóa</button>}
          <button className="btn primary" disabled={!f.dish.trim()} onClick={async () => (await db.put('food', f), toast('Đã lưu'), onClose())}>Lưu</button>
        </div>
      </div>
      <Confirm open={del} danger title="Xóa món này?" body="Chi phí liên kết (nếu có) vẫn được giữ trong Ngân sách." onConfirm={async () => (await db.del('food', f.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
