
import { t } from '../lib/i18n';
// Original, procedurally synthesized ambience (soft music-box bells over a warm pad).
// No recorded or copyrighted music. Off by default; starts only from a user tap.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let playing = false;
const subs = new Set<(p: boolean) => void>();
export const onAudio = (f: (p: boolean) => void) => (subs.add(f), () => subs.delete(f));
const emit = () => subs.forEach((f) => f(playing));
export const isPlaying = () => playing;

// a gentle pentatonic phrase in D major
const NOTES = [74, 76, 78, 81, 83, 86, 81, 78, 76, 74, 78, 81];
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function bell(t: number, m: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o2.type = 'sine';
  o.frequency.value = midi(m);
  o2.frequency.value = midi(m) * 2.76; // inharmonic partial → bell timbre
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(master);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
  o.start(t);
  o2.start(t);
  o.stop(t + 2.5);
  o2.stop(t + 2.5);
}

function pad(t: number) {
  if (!ctx || !master) return;
  for (const m of [50, 57, 62]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = midi(m);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 2);
    g.gain.linearRampToValueAtTime(0, t + 7.8);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 8);
  }
}

export async function startAmbience() {
  if (playing) return;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) throw new Error(t('Trình duyệt không hỗ trợ âm thanh Web Audio.'));
  ctx = ctx ?? new AC();
  await ctx!.resume();
  master = ctx!.createGain();
  master.gain.value = 0.7;
  master.connect(ctx!.destination);
  playing = true;
  let i = 0;
  const schedule = () => {
    if (!ctx || !playing) return;
    const t = ctx.currentTime + 0.05;
    if (i % 12 === 0) pad(t);
    bell(t, NOTES[i % NOTES.length]);
    i++;
    timer = window.setTimeout(schedule, 680 + (i % 4 === 3 ? 500 : 0));
  };
  schedule();
  emit();
}
export function stopAmbience() {
  playing = false;
  if (timer) clearTimeout(timer);
  timer = null;
  if (master && ctx) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    const m = master;
    setTimeout(() => m.disconnect(), 800);
  }
  master = null;
  emit();
}
/** Pause for speech playback / sensitive document viewing. */
export function pauseAmbienceFor(): () => void {
  if (!playing) return () => {};
  stopAmbience();
  return () => void startAmbience().catch(() => {});
}
