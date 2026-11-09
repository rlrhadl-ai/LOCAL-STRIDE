import { daeguAreaFromCourse } from './daegu-areas';
import type { Course, Weather } from './types';

export const MATES = [
  { id: 'bori', name: '재주곰', role: '차분한 페이스 코치', animal: '갈색 곰', color: '#805034', tint: '#F6EEE6', greeting: '우리에게 맞는 속도를 찾아봐요.', replyOpening: '기록을 함께 살펴볼게요. ', personality: '차분하고 간결하게 수치와 근거를 설명합니다. 기록의 한계를 인정하며 존댓말로 말합니다.', rate: .94, pitch: .95 },
  { id: 'daram', name: '달람쥐', role: '발랄한 동네 탐험가', animal: '다람쥐', color: '#AD5B25', tint: '#FFF2DE', greeting: '오늘도 한 걸음, 같이 가요!', replyOpening: '우리에게 맞는 길을 찾아봐요! ', personality: '호기심 많고 다정하게 작은 실천을 응원하는 동네 탐험가입니다. 제공된 코스와 장소를 근거로 경쟁이나 기록 압박 없이 밝은 존댓말로 말합니다.', rate: 1.04, pitch: 1.12 },
  { id: 'kkubugi', name: '꾸북이', role: '느긋한 습관 코치', animal: '거북이', color: '#507240', tint: '#EAF3E6', greeting: '천천히 가도 괜찮아요. 우리 오래 함께 달려요.', replyOpening: '서두르지 말고, 한 걸음씩 살펴봐요. ', personality: '느긋하고 다정한 거북이 친구입니다. 속도 경쟁보다 꾸준한 습관과 편안한 호흡을 응원합니다. 쉬는 날도 존중하고 작은 실천을 제안하며, 기록의 한계를 인정하고 부드러운 존댓말로 말합니다.', rate: .9, pitch: 1 },
] as const;
export type MateId = typeof MATES[number]['id'];
export type MateGoal = 'habit' | '5k' | '10k';
export type MateFeeling = 'good' | 'normal' | 'tired';
export type RunEffort = 'easy' | 'right' | 'hard';
export interface MatePreferences { mateId: MateId; goal: MateGoal; minutes: number; feeling: MateFeeling; theme: string }
export const DEFAULT_MATE_PREFERENCES: MatePreferences = { mateId: 'bori', goal: 'habit', minutes: 30, feeling: 'normal', theme: '' };
export interface MateProfile { id: string; nickname: string; homeArea: string; weeklyGoalKm: number; preferredPaceSec: number | null; isAuthenticated?: boolean }
export interface MateRun {
  id: string; mode: 'LIVE' | 'DEMO'; valid: boolean; status?: string;
  startedAt: string; finishedAt: string | null; distanceM: number; durationSec: number;
  avgPaceSec: number | null; course: { name: string; slug: string };
}
export interface MateFeedback { effort: RunEffort; liked: boolean | null }
export type FeedbackMap = Record<string, MateFeedback>;
export const paceLabel = (value: number | null) => {
  if (!value || !Number.isFinite(value)) return '아직 없어요';
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, '0')}″`;
};
export const mateById = (id: unknown) => MATES.find((mate) => mate.id === id) || MATES[0];
export const koreanDay = (now = new Date()) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const median = (numbers: number[]) => {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b), half = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2);
};

export function analyzeMateRuns(runs: MateRun[], now = Date.now()) {
  const day = 86400000;
  const recent = runs.filter((run) => {
    const start = Date.parse(run.startedAt), end = Date.parse(run.finishedAt || '');
    return run.mode === 'LIVE' && run.valid && Number.isFinite(start) && start >= now - 28 * day && start <= now
      && Number.isFinite(end) && end >= start && end <= now && (!run.status || run.status === 'FINISHED')
      && Number.isFinite(run.distanceM) && run.distanceM >= 300 && Number.isFinite(run.durationSec) && run.durationSec > 0;
  }).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const paces = recent.map((run) => run.durationSec / (run.distanceM / 1000)).filter((pace) => pace >= 180 && pace <= 1200);
  const distance = recent.reduce((sum, run) => sum + run.distanceM, 0);
  const recentWeek = recent.filter((run) => Date.parse(run.startedAt) >= now - 7 * day);
  const previousWeek = recent.filter((run) => Date.parse(run.startedAt) < now - 7 * day && Date.parse(run.startedAt) >= now - 14 * day);
  const weekKm = round1(recentWeek.reduce((sum, run) => sum + run.distanceM, 0) / 1000);
  const previousKm = round1(previousWeek.reduce((sum, run) => sum + run.distanceM, 0) / 1000);
  const latest = recent[0] || null;
  const comparable = latest ? recent.slice(1).filter((run) => run.course.slug === latest.course.slug && Math.abs(run.distanceM - latest.distanceM) <= latest.distanceM * .15) : [];
  const earlierPace = median(comparable.map((run) => run.durationSec / (run.distanceM / 1000)).filter((pace) => pace >= 180 && pace <= 1200));
  const latestPace = latest ? latest.durationSec / (latest.distanceM / 1000) : null;
  const comparison = latest && latestPace && latestPace >= 180 && latestPace <= 1200 && comparable.length >= 2 && earlierPace
    ? { delta: Math.round(latestPace - earlierPace), count: comparable.length, courseName: latest.course.name } : null;
  return { recent, latest, count: recent.length, paceSec: median(paces), paceSamples: paces.length,
    totalKm: round1(distance / 1000), averageKm: recent.length ? round1(distance / recent.length / 1000) : 0,
    longestKm: recent.length ? round1(Math.max(...recent.map((run) => run.distanceM)) / 1000) : 0,
    weekKm, weekRuns: recentWeek.length, previousKm, comparison };
}
export type MateAnalysis = ReturnType<typeof analyzeMateRuns>;

export function paceStory(analysis: MateAnalysis) {
  if (!analysis.count) return '아직 분석할 실제 완주 기록이 없어요. 첫 코스를 달리면 나만의 페이스 이야기가 시작돼요.';
  if (!analysis.paceSec) return '완주 기록은 있지만 페이스를 비교할 수 있는 측정값이 부족해요. 다음 러닝 기록을 함께 모아봐요.';
  const intro = `최근 28일 실제 완주 ${analysis.count}회 중 ${analysis.paceSamples}회의 대표 페이스는 ${paceLabel(analysis.paceSec)}/km예요.`;
  const comparison = analysis.comparison;
  if (!comparison) return `${intro} 같은 코스의 비슷한 거리 기록이 더 쌓이면 변화를 비교해드릴게요.`;
  const difference = Math.abs(comparison.delta);
  return `${intro} ${comparison.courseName}의 마지막 기록은 이전 ${comparison.count}회보다 ${difference < 5 ? '비슷한 속도였어요' : `km당 ${difference}초 ${comparison.delta < 0 ? '빨랐어요' : '느렸어요'}`}. 날씨·정지 시간 차이는 반영하지 않은 비교예요.`;
}

export function weatherStory(weather: Weather | null) {
  if (!weather) return '현재 날씨 정보를 확인하지 못했어요. 출발 전에 날씨를 확인해 주세요.';
  if (weather.source !== 'KMA') return '날씨는 저장된 참고 정보예요. 출발 전에 최신 날씨를 확인해 주세요.';
  const air = weather.airSource === 'AIRKOREA' ? ` · 미세먼지 ${weather.pm10Grade}` : '';
  return `${weather.temp}°C · ${weather.sky}${air}${weather.rainType !== '없음' ? ` · ${weather.rainType}, 야외 활동 전 기상 상황을 확인하세요.` : ''}`;
}

export function buildMatePlan(analysis: MateAnalysis, courses: Course[], preferences: MatePreferences, profile: MateProfile, areaName: string, feedback: FeedbackMap = {}, weather: Weather | null = null) {
  const latestEffort = analysis.latest ? feedback[analysis.latest.id]?.effort : undefined;
  const gentle = preferences.feeling === 'tired' || latestEffort === 'hard';
  const referencePace = analysis.paceSec || profile.preferredPaceSec;
  // These are approximate planning values, not a prediction of performance.
  const planningPace = Math.max(360, referencePace || 480) + (gentle ? 60 : 30);
  const baselineKm = analysis.averageKm || 3;
  const goalKm = preferences.goal === '10k' ? 10 : preferences.goal === '5k' ? 5 : baselineKm;
  const desiredKm = Math.min(goalKm, baselineKm * (gentle ? .8 : 1.1), preferences.minutes * 60 / planningPace);
  const ranked = courses.filter((course) => course.isPublic && Number.isFinite(course.distanceM) && course.distanceM >= 300).map((course) => {
    const km = course.distanceM / 1000;
    const minutes = Math.ceil(km * planningPace / 60);
    const courseArea = daeguAreaFromCourse(course);
    const local = courseArea?.name === areaName;
    const disliked = analysis.recent.some((run) => run.course.slug === course.slug && feedback[run.id]?.liked === false);
    const liked = analysis.recent.some((run) => run.course.slug === course.slug && feedback[run.id]?.liked === true);
    let score = 50 - Math.abs(km - desiredKm) * 7 + (local ? 16 : 0) + (liked ? 5 : 0) - (disliked ? 20 : 0);
    if (preferences.theme && course.themes.includes(preferences.theme)) score += 12;
    if (gentle) score -= course.elevationGainM / 10;
    const reasons = [local ? `선택한 ${areaName}에 있는 코스예요.` : `${courseArea?.name || course.areaName}의 대안 코스예요. 이동 시간을 따로 확인해 주세요.`];
    reasons.push(`이동 시간을 제외한 러닝 약 ${minutes}분으로, 선택한 ${preferences.minutes}분 안에 들어요.`);
    if (preferences.theme && course.themes.includes(preferences.theme)) reasons.push(`좋아하는 ‘${preferences.theme}’ 테마를 반영했어요.`);
    else if (course.elevationGainM <= 40) reasons.push(`등록된 누적 오르막 ${course.elevationGainM}m로 비교적 완만해요.`);
    else reasons.push(`누적 오르막 ${course.elevationGainM}m를 참고해 선택해 주세요.`);
    if (liked) reasons[2] = '전에 좋았다고 남긴 코스예요.';
    const withinExperience = analysis.longestKm ? km <= analysis.longestKm * 1.15 : km <= 5;
    return { course, minutes, score, reasons, local, eligible: minutes <= preferences.minutes && withinExperience && (!gentle || km <= baselineKm && course.elevationGainM <= 60) };
  }).filter((item) => item.eligible).sort((a, b) => b.score - a.score || a.minutes - b.minutes).slice(0, 3);
  const paceRange = referencePace ? `${paceLabel(referencePace + (gentle ? 30 : 15))}–${paceLabel(referencePace + (gentle ? 90 : 60))}/km` : null;
  return { routes: ranked, gentle, paceRange, desiredKm: round1(desiredKm), planningPace,
    paceBasis: analysis.paceSec ? '최근 기록을 참고한 여유 페이스' : referencePace ? '직접 설정한 페이스를 참고했어요' : '첫 기록을 쌓으며 편한 속도를 찾아요',
    weather: weatherStory(weather),
    message: gentle ? '오늘은 여유를 선택해도 좋아요. 짧고 완만한 코스부터 살펴봐요.' : ranked.length ? `${ranked[0].course.name}, 어때요? 오늘 가능한 시간과 러닝 기록을 함께 살펴 골랐어요.` : '지금 조건에 맞는 등록 코스가 없어요. 시간을 늘리거나 다른 지역의 코스를 살펴볼까요?' };
}
export type MatePlan = ReturnType<typeof buildMatePlan>;

export function mateReply(question: string, mateId: MateId, analysis: MateAnalysis, plan: MatePlan) {
  const mate = mateById(mateId);
  const q = question.trim();
  let answer: string;
  if (/통증|아파|아프|부상|진단/.test(q)) answer = '통증이나 부상 원인은 러닝 기록만으로 판단할 수 없어요. 아픈 상태에서 기록을 늘리기보다 러닝을 멈추고 상태를 확인해 주세요. 필요하면 의료 전문가와 상담해 주세요.';
  else if (/페이스|속도|빨라|느려|분석/.test(q)) answer = paceStory(analysis);
  else if (/주간|이번 주|지난주|얼마나/.test(q)) answer = `최근 7일은 ${analysis.weekRuns}회, ${analysis.weekKm.toFixed(1)}km를 달렸어요. 그 전 7일은 ${analysis.previousKm.toFixed(1)}km였어요. 지난 28일의 실제 완주 기록을 기준으로 집계했어요.`;
  else if (/날씨|비가|미세|기온/.test(q)) answer = plan.weather;
  else if (/코스|어디|장소|추천|오늘|달릴/.test(q)) answer = `${plan.message}${plan.routes[0] ? ` ${plan.routes[0].reasons.slice(0, 2).join(' ')}${plan.paceRange ? ` 페이스는 ${plan.paceRange}를 참고하되 편한 호흡을 우선해요.` : ''}` : ''}`;
  else if (/응원|힘내|인사|안녕/.test(q)) answer = analysis.count ? `${analysis.count}번의 완주가 차곡차곡 쌓였어요. 오늘도 나에게 맞는 한 걸음이면 충분해요!` : '처음부터 잘 달릴 필요는 없어요. 편한 신발을 신고, 나에게 맞는 첫 코스부터 같이 찾아봐요!';
  else answer = '지금은 기록 기반 안내로 도와드리고 있어요. “내 페이스 분석”, “오늘 코스 추천”, “주간 리포트”를 물어보면 확인된 정보로 답해드릴게요.';
  return mate.replyOpening + answer;
}
