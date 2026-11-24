import { useState } from 'react';
import { LuGlobe, LuCheck } from 'react-icons/lu';
import { saveSettings } from '../db/repo';
import { getLang, LANG_NAMES, t, type Lang } from '../lib/i18n';
import { Sheet } from './core';

const ORDER: Lang[] = ['vi', 'zh', 'en', 'ko'];
const SHORT: Record<Lang, string> = { vi: 'VI', zh: '中文', en: 'EN', ko: '한국어' };

/** One global language preference (stored in IndexedDB settings → survives reloads & offline). */
export function LanguageList({ onDone }: { onDone?: () => void }) {
  const cur = getLang();
  return (
    <div className="menu-list" role="radiogroup" aria-label={t('Ngôn ngữ giao diện')}>
      {ORDER.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={cur === l}
          lang={l === 'zh' ? 'zh-CN' : l}
          data-lang={l}
          onClick={async () => {
            await saveSettings({ language: l });
            onDone?.();
          }}
        >
          <span className="grow">{LANG_NAMES[l]}</span>
          {cur === l && <LuCheck />}
        </button>
      ))}
    </div>
  );
}

export function LanguageButton({ glass }: { glass?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`lang-btn ${glass ? 'glass' : ''}`} aria-label={`${t('Ngôn ngữ')}: ${LANG_NAMES[getLang()]}`} data-testid="lang-button" onClick={() => setOpen(true)}>
        <LuGlobe size={18} /> <span>{SHORT[getLang()]}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Ngôn ngữ')}>
        <LanguageList onDone={() => setOpen(false)} />
        <p className="muted xsmall">{t('Chỉ đổi ngôn ngữ giao diện. Nhật ký, ghi chú, tên và địa chỉ bạn đã nhập được giữ nguyên.')}</p>
      </Sheet>
    </>
  );
}
