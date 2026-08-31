export interface InsightRun {
  distanceM: number;
  durationSec: number;
  avgPaceSec: number | null;
  startedAt: string;
  finishedAt: string | null;
  valid: boolean;
}

export interface InsightProfile {
  homeArea: string;
  weeklyGoalKm: number;
  preferredPaceSec: number | null;
  bio?: string | null;
}

export interface RecommendationCandidate {
  id: string;
  href: string;
  title: string;
  description: string;
  startsAt: string;
  place: string | null;
  distanceM: number | null;
  paceSec: number | null;
  feeKrw: number;
  typeLabel: string;
  preview: boolean;
}

export interface RunnerInsight {
  label: string;
  sourceLabel: '러닝 기록 기반' | '직접 설정 기반';
  confidence: '충분' | '보통' | '초기';
  recentRuns: number;
  runsPerWeek: number;
  averageKm: number;
  longestKm: number;
  paceSec: number | null;
  favoriteTime: '아침' | '낮' | '저녁' | '기록 수집 중';
}

export interface EventRecommendation extends RecommendationCandidate {
  score: number;
  reasons: string[];
  caution: string | null;
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const paceOf = (run: InsightRun) => run.avgPaceSec || (run.distanceM > 0 ? Math.round(run.durationSec / (run.distanceM / 1000)) : null);

const areaToken = (value: string) => {
  const known = ['수성구', '달서구', '중구', '동구', '서구', '남구', '북구', '달성군', '군위군'];
  const district = known.find((item) => value.includes(item));
  if (district) return district;
  if (/수성못|들안길/.test(value)) return '수성구';
  if (/신천/.test(value)) return '남구';
  if (/앞산/.test(value)) return '남구';
  if (/월광|달서/.test(value)) return '달서구';
  return '';
};

type ActivityTime = '아침' | '낮' | '저녁';
const timeLabel = (date: Date): ActivityTime => date.getHours() < 10 ? '아침' : date.getHours() >= 17 ? '저녁' : '낮';

export function buildRunnerInsight(runs: InsightRun[], profile: InsightProfile): RunnerInsight {
  const since = Date.now() - 28 * 86400000;
  const recent = runs.filter((run) => run.valid && new Date(run.startedAt).getTime() >= since);
  const measuredPaces = recent.map(paceOf).filter((value): value is number => Boolean(value && value >= 180 && value <= 900));
  const distances = recent.map((run) => run.distanceM / 1000).filter((value) => value > 0);
  const paceSec = measuredPaces.length >= 3 ? median(measuredPaces) : profile.preferredPaceSec;
  const longestKm = distances.length ? Math.max(...distances) : 0;
  const averageKm = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
  const counts = recent.reduce((result, run) => {
    const key = timeLabel(new Date(run.startedAt)); result[key] += 1; return result;
  }, { 아침: 0, 낮: 0, 저녁: 0 } as Record<ActivityTime, number>);
  const favoriteTime = recent.length ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as RunnerInsight['favoriteTime']) : '기록 수집 중';
  const referenceKm = longestKm || Math.max(3, Math.min(10, profile.weeklyGoalKm / 2));
  const label = recent.length < 3
    ? referenceKm >= 8 ? '10K 목표 러너' : '5K 목표 러너'
    : referenceKm >= 12 ? '장거리 도전 러너' : referenceKm >= 8 ? '10K 준비 러너' : referenceKm >= 5 ? '5K 안정 러너' : '5K 입문 러너';
  return {
    label,
    sourceLabel: recent.length >= 3 ? '러닝 기록 기반' : '직접 설정 기반',
    confidence: recent.length >= 5 ? '충분' : recent.length >= 3 ? '보통' : '초기',
    recentRuns: recent.length,
    runsPerWeek: Math.round((recent.length / 4) * 10) / 10,
    averageKm: Math.round(averageKm * 10) / 10,
    longestKm: Math.round(longestKm * 10) / 10,
    paceSec,
    favoriteTime,
  };
}

export function rankEvents(candidates: RecommendationCandidate[], insight: RunnerInsight, profile: InsightProfile): EventRecommendation[] {
  const profileArea = areaToken(profile.homeArea);
  const referenceKm = insight.longestKm || Math.max(3, Math.min(10, profile.weeklyGoalKm / 2));
  const interests = ['수변', '야경', '미식', '역사', '자연', '골목'].filter((theme) => `${profile.bio || ''}`.includes(theme));

  return candidates
    .filter((candidate) => new Date(candidate.startsAt).getTime() > Date.now())
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];
      const distanceKm = candidate.distanceM ? candidate.distanceM / 1000 : null;
      const distanceGap = distanceKm ? Math.abs(distanceKm - referenceKm) : 3;
      const ability = distanceKm ? Math.max(4, 30 - distanceGap * 4) : 16;
      score += ability;
      if (distanceKm) reasons.push(`${distanceKm.toFixed(1)}km로 현재 기준 거리 ${referenceKm.toFixed(1)}km와 ${distanceGap <= 1.5 ? '잘 맞아요' : '비교해 추천했어요'}.`);

      const eventTime = timeLabel(new Date(candidate.startsAt));
      const schedule = insight.favoriteTime === '기록 수집 중' ? 14 : insight.favoriteTime === eventTime ? 25 : 11;
      score += schedule;
      reasons.push(insight.favoriteTime === '기록 수집 중' ? `${eventTime} 일정으로 초기 선호를 확인할 수 있어요.` : `${insight.favoriteTime} 러닝 패턴과 ${eventTime === insight.favoriteTime ? '일치해요' : '비교했어요'}.`);

      const eventArea = areaToken(`${candidate.place || ''} ${candidate.description}`);
      const areaMatch = Boolean(profileArea && eventArea && profileArea === eventArea);
      score += areaMatch ? 20 : 9;
      reasons.push(areaMatch ? `${profile.homeArea} 활동 지역과 가까운 일정이에요.` : `${candidate.place || '대구 지역'}에서 열리는 일정이에요.`);

      const matchedInterest = interests.find((theme) => `${candidate.title} ${candidate.description}`.includes(theme));
      score += matchedInterest ? 15 : 8;
      if (matchedInterest) reasons.push(`프로필의 ‘${matchedInterest}’ 관심사와 연결돼요.`);

      const paceGap = insight.paceSec && candidate.paceSec ? Math.abs(insight.paceSec - candidate.paceSec) : null;
      score += paceGap == null ? 6 : paceGap <= 45 ? 10 : paceGap <= 90 ? 6 : 2;
      const tooLong = Boolean(distanceKm && insight.longestKm > 0 && distanceKm > insight.longestKm * 1.3);
      const tooFast = Boolean(paceGap != null && candidate.paceSec! < insight.paceSec! - 60);
      const caution = tooLong ? `최근 최장 거리보다 ${Math.round((distanceKm! / insight.longestKm - 1) * 100)}% 길어 컨디션 확인이 필요해요.` : tooFast ? '평소 페이스보다 빨라 무리하지 않는 선택이 필요해요.' : null;
      return { ...candidate, score: Math.max(45, Math.min(96, Math.round(score))), reasons: reasons.slice(0, 3), caution };
    })
    .sort((a, b) => b.score - a.score || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 3);
}
