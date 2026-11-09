'use client';
import { useEffect, useRef, useState } from 'react';
import { mateById, type MateId } from '@/lib/ai-mate';
import MateAvatar, { type MateMood } from './MateAvatar';

export default function MateSpeech({ mateId, text, mood = 'idle' }: { mateId: MateId; text: string; mood?: MateMood }) {
  const mate = mateById(mateId);
  const [visible, setVisible] = useState(text);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    setSupported('speechSynthesis' in window);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(text); return; }
    const letters = Array.from(text); let count = 0;
    setVisible('');
    const timer = window.setInterval(() => { count += 3; setVisible(letters.slice(0, count).join('')); if (count >= letters.length) window.clearInterval(timer); }, 25);
    return () => window.clearInterval(timer);
  }, [text, mateId]);
  useEffect(() => {
    return () => { if (utterance.current && 'speechSynthesis' in window) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); } };
  }, []);
  useEffect(() => {
    if ('speechSynthesis' in window && utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis.cancel(); utterance.current = null; }
    setSpeaking(false); setVoiceNotice('');
  }, [text, mateId]);
  function speak() {
    if (!supported) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const voice = new SpeechSynthesisUtterance(text);
    voice.lang = 'ko-KR'; voice.rate = mate.rate; voice.pitch = mate.pitch;
    const korean = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith('ko'));
    if (korean) voice.voice = korean;
    voice.onstart = () => setSpeaking(true);
    voice.onend = () => { setSpeaking(false); utterance.current = null; };
    voice.onerror = () => { setSpeaking(false); setVoiceNotice('이 기기에서 음성을 재생하지 못했어요.'); };
    utterance.current = voice; window.speechSynthesis.speak(voice);
  }
  const activeMood = mood === 'thinking' ? 'thinking' : speaking || visible.length < text.length ? 'talking' : mood;
  return <section className={`mate-stage ${speaking ? 'is-speaking' : ''}`} style={{ '--mate-color': mate.color, '--mate-tint': mate.tint } as React.CSSProperties} aria-label={`${mate.name}의 이야기`}>
    <div className="mate-stage-art"><div className="mate-stage-orbit" aria-hidden/><MateAvatar mateId={mate.id} mood={activeMood} priority/><span className="mate-stage-name">{mate.name}<small>{mate.role}</small></span></div>
    <div className="mate-bubble"><div className="mate-bubble-head"><span>{speaking ? '이야기하는 중' : '너의 러닝 메이트'}</span>{supported && <button type="button" onClick={speak} aria-label={speaking ? '음성 멈추기' : `${mate.name}의 이야기 듣기`} aria-pressed={speaking}>{speaking ? '■' : '▶'} <span>{speaking ? '멈춤' : '듣기'}</span></button>}</div><p aria-hidden>{visible}<span className={visible.length < text.length ? 'mate-cursor' : 'mate-cursor hidden'} aria-hidden/></p><p className="mate-sr-only" aria-live="polite">{text}</p>{voiceNotice && <small role="status">{voiceNotice}</small>}<span className="mate-bubble-dot" aria-hidden/></div>
  </section>;
}
