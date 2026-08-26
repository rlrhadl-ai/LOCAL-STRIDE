'use client';
import { useEffect, useRef } from 'react';
import { fmtTime } from '@/lib/types';

export default function RecordCard({ courseName, distanceM, durationSec, pace, checkins, checkpoints, medalName, challenge, couponTitle }: { courseName: string; distanceM: number; durationSec: number; pace: string; checkins: number; checkpoints: number; medalName: string | null; challenge: string | null; couponTitle: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height, F = 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#12306E'); g.addColorStop(1, '#061A40'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(27,91,223,.35)'; ctx.beginPath(); ctx.arc(W * .85, H * .12, 300, 0, Math.PI * 2); ctx.fill();
    const draw = (logo?: HTMLImageElement) => {
      if (logo) ctx.drawImage(logo, 72, 70, 300, 300 * logo.naturalHeight / logo.naturalWidth);
      ctx.fillStyle = '#E4B23A'; ctx.font = `800 30px ${F}`; ctx.textAlign = 'right'; ctx.fillText('MY RECORD', W - 72, 118);
      ctx.textAlign = 'left'; ctx.fillStyle = '#C9D6F5'; ctx.font = `600 34px ${F}`; ctx.fillText(`${courseName} · 대구`, 72, 300);
      const big = (distanceM / 1000).toFixed(2); ctx.fillStyle = '#fff'; ctx.font = `900 190px ${F}`; ctx.fillText(big, 60, 520); const bw = ctx.measureText(big).width; ctx.font = `800 60px ${F}`; ctx.fillText('km', 60 + bw + 16, 520);
      [[fmtTime(durationSec), '시간'], [pace, '페이스'], [`${checkins}/${checkpoints}`, '체크인']].forEach(([v, l], i) => { const x = 72 + i * 320; ctx.fillStyle = '#fff'; ctx.font = `800 72px ${F}`; ctx.fillText(v, x, 660); ctx.fillStyle = '#BFD0F7'; ctx.font = `600 28px ${F}`; ctx.fillText(l, x, 706); });
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(72, 760); ctx.lineTo(W - 72, 760); ctx.stroke();
      if (medalName) {
        const mg = ctx.createRadialGradient(240, 960, 20, 240, 960, 140); mg.addColorStop(0, '#FFE58A'); mg.addColorStop(.6, '#D89A1B'); mg.addColorStop(1, '#A66F0E'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(240, 960, 130, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5C3D05'; ctx.textAlign = 'center'; ctx.font = `900 30px ${F}`; medalName.split(' ').slice(0, 2).forEach((w, i) => ctx.fillText(w, 240, 950 + i * 42));
        ctx.textAlign = 'left'; ctx.fillStyle = '#E4B23A'; ctx.font = `800 28px ${F}`; ctx.fillText('대구 한정 메달 획득', 420, 920);
        ctx.fillStyle = '#fff'; ctx.font = `800 52px ${F}`; ctx.fillText(medalName, 420, 985);
      } else { ctx.fillStyle = '#fff'; ctx.font = `800 44px ${F}`; ctx.fillText('완주 기록', 72, 940); }
      ctx.fillStyle = '#C9D6F5'; ctx.font = `600 30px ${F}`; ctx.fillText([challenge, couponTitle].filter(Boolean).join(' · '), medalName ? 420 : 72, 1040);
      ctx.fillStyle = '#8FA3D9'; ctx.font = `600 30px ${F}`; ctx.fillText(`${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} · #로컬스트라이드 #달리면서여행`, 72, 1250);
    };
    const img = new Image(); img.src = '/logo-white.png'; img.onload = () => draw(img); img.onerror = () => draw(); if (img.complete && img.naturalWidth) draw(img);
  }, [courseName, distanceM, durationSec, pace, checkins, checkpoints, medalName, challenge, couponTitle]);
  const save = () => { const a = document.createElement('a'); a.download = 'localstride_record.png'; a.href = ref.current!.toDataURL('image/png'); a.click(); };
  return <div><canvas ref={ref} width={1080} height={1350} className="record-canvas" /><button className="btn light" type="button" onClick={save}>카드 이미지 저장</button></div>;
}
