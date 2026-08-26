/**
 * AI 러닝 동반자 — 러너 위치 반경 관광지(TourAPI 컨텍스트)를 넣고 짧게 답한다.
 * ANTHROPIC_API_KEY 가 없으면 규칙 기반 답변으로 폴백.
 */
import type { PoiItem } from './tourapi';

const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

export async function askCompanion(question: string, pois: PoiItem[], ctx: { courseName?: string; distanceM?: number }): Promise<{ answer: string; source: 'CLAUDE' | 'RULE' }> {
  const nearest = pois[0];
  if (!KEY) {
    const answer = nearest
      ? `${nearest.title}${nearest.addr1 ? ` (${nearest.addr1})` : ''}이(가) ${nearest.dist}m 앞에 있어요. ${nearest.overview ? nearest.overview.slice(0, 90) + '…' : `${nearest.type}로 등록된 곳이에요. 잠시 속도를 늦추고 둘러보세요.`}`
      : '반경 500m 안에 등록된 관광지가 아직 없어요. 조금 더 달리면 다음 체크포인트 근처에서 안내할게요.';
    return { answer, source: 'RULE' };
  }
  const context = pois.slice(0, 5).map((p) => `- ${p.title} (${p.type}, ${p.dist}m${p.addr1 ? `, ${p.addr1}` : ''})${p.overview ? `: ${p.overview.slice(0, 200)}` : ''}`).join('\n');
  const system = `당신은 대구 러닝 관광 앱 '로컬 스트라이드'의 음성 동반자입니다. 러너가 달리는 중이므로 2문장, 60자 안팎으로 답합니다. 아래 한국관광공사 TourAPI 데이터에 있는 장소만 근거로 말하고, 없으면 모른다고 합니다. 반말 금지, 친근한 존댓말.`;
  const user = `현재 코스: ${ctx.courseName ?? '알 수 없음'} · 달린 거리 ${Math.round((ctx.distanceM ?? 0) / 100) / 10}km\n반경 500m 장소:\n${context || '(없음)'}\n\n러너 질문: ${question}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data: any = await res.json();
  const answer = (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
  return { answer, source: 'CLAUDE' };
}
