'use client';
let enabled = true;
export function setVoice(v: boolean) { enabled = v; if (!v && typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }
export function voiceOn() { return enabled; }
export function speak(text: string, force = false) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || (!enabled && !force)) return;
  try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.02; const v = window.speechSynthesis.getVoices().find((x) => /ko/i.test(x.lang)); if (v) u.voice = v; window.speechSynthesis.speak(u); } catch {}
}
