import { pauseAmbienceFor } from '../art/audio';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices();
  const pref = lang.toLowerCase();
  // prefer Mainland Mandarin voices (e.g. iOS "Tingting"), then any zh
  return vs.find((v) => v.lang.toLowerCase() === pref) ?? vs.find((v) => v.lang.toLowerCase().startsWith(pref.slice(0, 2)));
}
/** Speaks text; resolves false if the device has no suitable voice. Online/offline depends on the OS voice. */
export function speak(text: string, lang = 'zh-CN', rate = 0.85): Promise<boolean> {
  if (!speechSupported()) return Promise.resolve(false);
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    const resume = pauseAmbienceFor();
    u.onend = () => (resume(), resolve(true));
    u.onerror = () => (resume(), resolve(false));
    speechSynthesis.speak(u);
  });
}
