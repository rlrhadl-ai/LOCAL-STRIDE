'use client';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MateAvatar, { type MateMood } from '@/components/MateAvatar';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import MateSpeech from '@/components/MateSpeech';
import { useDaeguArea } from '@/components/DaeguAreaProvider';
import { api, deviceId, mediaUrl } from '@/lib/api';
import { DAEGU_AREAS } from '@/lib/daegu-areas';
import { MATES, DEFAULT_MATE_PREFERENCES, analyzeMateRuns, buildMatePlan, koreanDay, mateById, mateReply, paceLabel, paceStory, type FeedbackMap, type MateFeedback, type MateId, type MatePreferences, type MateProfile, type MateRun } from '@/lib/ai-mate';
import type { Course, Weather } from '@/lib/types';

type Panel = 'today' | 'pace' | 'chat';
interface ChatMessage { id: number; role: 'user' | 'assistant'; text: string; mateId: MateId; source?: 'AI' | 'RULE' }
interface LoadedData { profile: MateProfile; runs: MateRun[]; courses: Course[]; aiEnabled: boolean }
const PANELS: { id: Panel; label: string }[] = [{ id: 'today', label: '오늘의 러닝' }, { id: 'pace', label: '내 페이스' }, { id: 'chat', label: '메이트와 대화' }];
const PROMPTS = ['내 페이스 분석해줘', '오늘 어디를 뛰면 좋을까?', '주간 리포트 보여줘', '응원 한마디 해줘'];
const EFFORTS = [{ value: 'easy', label: '여유로웠어요' }, { value: 'right', label: '적당했어요' }, { value: 'hard', label: '힘들었어요' }] as const;

function restorePreferences(raw: unknown): MatePreferences {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return { mateId: mateById(value.mateId).id,
    goal: value.goal === '5k' || value.goal === '10k' ? value.goal : 'habit',
    minutes: [20, 30, 45, 60].includes(Number(value.minutes)) ? Number(value.minutes) : 30,
    feeling: value.day === koreanDay() && (value.feeling === 'good' || value.feeling === 'tired') ? value.feeling : 'normal',
    theme: typeof value.theme === 'string' && ['수변', '야경', '자연', '역사', '미식', '골목'].includes(value.theme) ? value.theme : '' };
}

export default function AiMatePage() {
  const { area, setAreaSlug } = useDaeguArea();
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [preferences, setPreferences] = useState<MatePreferences>(DEFAULT_MATE_PREFERENCES);
  const [feedback, setFeedback] = useState<FeedbackMap>({});
  const [stored, setStored] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const [panel, setPanel] = useState<Panel>('today');
  const [speech, setSpeech] = useState('');
  const [emotion, setEmotion] = useState<MateMood>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const mounted = useRef(true);
  const mate = mateById(preferences.mateId);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [me, runs, courses, mode] = await Promise.all([api.get<{ user: MateProfile }>('/me'), api.get<{ items: MateRun[] }>('/me/runs'), api.get<{ items: Course[] }>('/courses'), fetch('/api/mate-chat').then((response) => response.ok ? response.json() : null).catch(() => null)]);
      if (!me.user?.id || !Array.isArray(runs.items) || !Array.isArray(courses.items)) throw new Error('invalid response');
      if (mounted.current) setData({ profile: me.user, runs: runs.items, courses: courses.items, aiEnabled: mode?.enabled === true });
    } catch { if (mounted.current) setError('러닝 기록과 코스를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; requestRef.current?.abort(); }; }, [load]);
  useEffect(() => {
    let active = true; setWeather(null);
    api.get<Weather>(`/weather/now?lat=${area.lat}&lng=${area.lng}`).then((value) => { if (active) setWeather(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [area.lat, area.lng]);
  useEffect(() => {
    if (!data?.profile.id) return;
    setStored(false);
    try {
      const saved = JSON.parse(localStorage.getItem(`ls_ai_mate_v1:${data.profile.id}`) || '{}');
      setPreferences(restorePreferences(saved));
      const restored: FeedbackMap = {};
      for (const run of data.runs) {
        const item = saved.feedback?.[run.id];
        if (item && EFFORTS.some((effort) => effort.value === item.effort)) restored[run.id] = { effort: item.effort, liked: typeof item.liked === 'boolean' ? item.liked : null };
      }
      setFeedback(restored);
    } catch { setPreferences(DEFAULT_MATE_PREFERENCES); setFeedback({}); setStorageNotice('저장된 설정을 불러오지 못했어요. 다시 선택해 주세요.'); }
    setStored(true);
  }, [data?.profile.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!stored || !data) return;
    try { localStorage.setItem(`ls_ai_mate_v1:${data.profile.id}`, JSON.stringify({ ...preferences, feedback, day: koreanDay() })); }
    catch { setStorageNotice('설정을 저장할 공간이 없어요. 이 화면에서는 계속 사용할 수 있어요.'); }
  }, [stored, data, preferences, feedback]);
  useEffect(() => { if (panel === 'chat' && messages.length) chatEnd.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, [messages, asking, panel]);

  const analysis = useMemo(() => analyzeMateRuns(data?.runs || []), [data?.runs]);
  const plan = useMemo(() => data ? buildMatePlan(analysis, data.courses, preferences, data.profile, area.name, feedback, weather) : null, [analysis, data, preferences, area.name, feedback, weather]);
  function chooseMate(id: MateId) {
    setEmotion('cheering');
    requestRef.current?.abort(); setAsking(false); setChatNotice('');
    setPreferences((current) => ({ ...current, mateId: id }));
    const selected = mateById(id); setSpeech(`안녕하세요, 저는 ${selected.name}${selected.id === 'bori' ? '이에요' : '예요'}. ${selected.greeting} 앞으로 러닝 기록과 다음 코스를 함께 살펴봐요.`);
  }
  function updatePreference<K extends keyof MatePreferences>(key: K, value: MatePreferences[K]) { setPreferences((current) => ({ ...current, [key]: value })); setSpeech(''); setEmotion('idle'); }
  function saveFeedback(runId: string, value: Partial<MateFeedback>) {
    setEmotion(value.effort === 'hard' ? 'resting' : 'cheering');
    setFeedback((current) => ({ ...current, [runId]: { effort: current[runId]?.effort || 'right', liked: current[runId]?.liked ?? null, ...value } }));
    setSpeech('알려줘서 고마워요. 오늘 느낀 난이도와 코스 취향을 다음 추천에 반영했어요.');
  }
  async function ask(text: string) {
    if (!data || !plan || asking || !text.trim()) return;
    const clean = text.trim().slice(0, 300), selectedId = mate.id;
    setEmotion(/응원|힘내/.test(clean) ? 'cheering' : 'idle');
    setPanel('chat'); setQuestion(''); setChatNotice(''); setAsking(true);
    setMessages((current) => [...current.slice(-19), { id: ++nextId.current, role: 'user', text: clean, mateId: selectedId }]);
    const controller = new AbortController(); requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort('timeout'), 28000);
    try {
      const response = await fetch('/api/mate-chat', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-device-id': deviceId() },
        body: JSON.stringify({ question: clean, preferences, area: area.slug, feedback, history: messages.slice(-4).map((message) => ({ role: message.role, content: message.text.slice(0, 600) })) }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok || typeof result.answer !== 'string') throw new Error(response.status === 429 ? '잠시 쉬었다가 다시 물어봐 주세요.' : 'AI 연결을 기다리고 있어요.');
      if (!mounted.current || requestRef.current !== controller) return;
      const source = result.source === 'AI' ? 'AI' : 'RULE';
      setMessages((current) => [...current, { id: ++nextId.current, role: 'assistant', text: result.answer, mateId: selectedId, source }]);
      setSpeech(result.answer); setChatNotice(result.notice || '');
    } catch (failure) {
      if (!mounted.current || requestRef.current !== controller || controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      const answer = mateReply(clean, selectedId, analysis, plan);
      setMessages((current) => [...current, { id: ++nextId.current, role: 'assistant', text: answer, mateId: selectedId, source: 'RULE' }]);
      setSpeech(answer); setChatNotice(failure instanceof Error && failure.message.includes('쉬었다') ? failure.message : '지금은 기록 기반 안내로 답하고 있어요. 자유로운 AI 대화는 연결이 복구되면 이용할 수 있어요.');
    } finally { window.clearTimeout(timer); if (mounted.current && requestRef.current === controller) { requestRef.current = null; setAsking(false); } }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(question); }
  const greeting = speech || (data && plan ? analysis.count ? plan.message : `${mate.greeting} 아직 실제 완주 기록이 없어요. 오늘 마음에 드는 코스부터 찾아볼까요?` : mate.greeting);

  return <main className="page ai-mate-page">
    <AppHeader title="AI 메이트" right={<Link className="mate-profile-link" href="/me">내 기록 ↗</Link>}/>
    <header className="mate-intro"><span>YOUR LITTLE RUNNING TEAM</span><h1>같이 달리면,<br/><em>조금 더 즐거워요.</em></h1><p>나를 알아가는 친구와 오늘의 러닝을 시작해요.</p></header>
    <section className="mate-selector" aria-labelledby="mate-select-title"><div className="mate-section-head"><h2 id="mate-select-title">나의 러닝 메이트</h2><span>언제든 바꿀 수 있어요</span></div><div className="mate-options">{MATES.map((character) => <button key={character.id} type="button" disabled={!stored && !error} aria-pressed={mate.id === character.id} aria-label={`${character.name}, ${character.role} 선택`} onClick={() => chooseMate(character.id)} className={`mate-option ${mate.id === character.id ? 'selected' : ''}`} style={{ '--mate-tint': character.tint, '--mate-color': character.color } as React.CSSProperties}><span className="mate-option-check" aria-hidden>{mate.id === character.id ? '✓' : '+'}</span><MateAvatar mateId={character.id} decorative/><strong>{character.name}</strong><small>{character.role}</small></button>)}</div><p className="mate-storage-note" role="status">{storageNotice || '메이트와 취향은 이 기기에 저장돼요. 두 친구 모두 분석과 추천을 도와줘요.'}</p></section>
    <MateSpeech mateId={mate.id} text={greeting} mood={loading || asking ? 'thinking' : preferences.feeling === 'tired' ? 'resting' : emotion}/>
    {loading ? <div className="mate-loading" role="status"><span/><p>내 러닝 기록을 살펴보는 중이에요…</p></div> : error ? <div className="mate-error" role="alert"><p>{error}</p><button className="btn" type="button" onClick={load}>다시 불러오기</button></div> : data && plan && <>
      <div className="mate-panels" role="tablist" aria-label="AI 메이트 기능">{PANELS.map((item) => <button key={item.id} id={`mate-tab-${item.id}`} type="button" role="tab" tabIndex={panel === item.id ? 0 : -1} onKeyDown={(event) => { const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']; if (!keys.includes(event.key)) return; event.preventDefault(); const index = PANELS.findIndex((tab) => tab.id === panel); const next = event.key === 'Home' ? 0 : event.key === 'End' ? PANELS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + PANELS.length) % PANELS.length; setPanel(PANELS[next].id); document.getElementById(`mate-tab-${PANELS[next].id}`)?.focus(); }} aria-selected={panel === item.id} aria-controls={`mate-panel-${item.id}`} onClick={() => { setPanel(item.id); setSpeech(''); }}>{item.label}</button>)}</div>
      {panel === 'today' && <section id="mate-panel-today" role="tabpanel" aria-labelledby="mate-tab-today">
        <div className="mate-section-head"><h2>오늘은 어떻게 달릴까요?</h2><span>추천에 바로 반영돼요</span></div>
        <div className="mate-preferences">
          <label>나의 목표<select value={preferences.goal} onChange={(event) => updatePreference('goal', event.target.value as MatePreferences['goal'])}><option value="habit">꾸준히 즐겁게 달리기</option><option value="5k">5km 편안하게 완주하기</option><option value="10k">10km 차근차근 준비하기</option></select></label>
          <label>달릴 지역<select value={area.slug} onChange={(event) => { setAreaSlug(event.target.value); setSpeech(''); }}>{DAEGU_AREAS.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.hub}</option>)}</select></label>
          <fieldset><legend>달릴 수 있는 시간</legend><div className="mate-chips">{[20, 30, 45, 60].map((minutes) => <button key={minutes} type="button" aria-pressed={preferences.minutes === minutes} onClick={() => updatePreference('minutes', minutes)}>{minutes}분</button>)}</div></fieldset>
          <fieldset><legend>오늘의 컨디션</legend><div className="mate-chips">{([{ id: 'good', label: '가뿐해요' }, { id: 'normal', label: '평소 같아요' }, { id: 'tired', label: '조금 피곤해요' }] as const).map((item) => <button key={item.id} type="button" aria-pressed={preferences.feeling === item.id} onClick={() => updatePreference('feeling', item.id)}>{item.label}</button>)}</div></fieldset>
          <label>좋아하는 코스 분위기<select value={preferences.theme} onChange={(event) => updatePreference('theme', event.target.value)}><option value="">어떤 길이든 좋아요</option>{['수변', '야경', '자연', '역사', '미식', '골목'].map((theme) => <option key={theme} value={theme}>{theme}</option>)}</select></label>
        </div>
        <div className="mate-weather"><span aria-hidden>◌</span><p>{plan.weather}</p></div>
        <div className="mate-section-head"><div><span className="mate-eyebrow">PICKED FOR YOU</span><h2>{mate.name}{mate.id === 'bori' ? '이' : '가'} 고른 오늘의 코스</h2></div><span>최대 3곳</span></div>
        {plan.paceRange && <p className="mate-pace-hint">여유 페이스 <strong>{plan.paceRange}</strong><small>{plan.paceBasis} · 편한 호흡을 우선해요</small></p>}
        {plan.routes.length ? <div className="mate-routes">{plan.routes.map((item, index) => <article key={item.course.id} className="running-mate-route"><div className="running-mate-route-cover">{item.course.thumbnailUrl ? <img src={mediaUrl(item.course.thumbnailUrl)} alt="" loading="lazy"/> : <div className="running-mate-route-placeholder" aria-hidden>LOCAL<br/>STRIDE</div>}<span>{index === 0 ? '첫 번째 추천' : `추천 ${index + 1}`}</span><b>{(item.course.distanceM / 1000).toFixed(1)}<small>km</small></b></div><div className="running-mate-route-body"><div className="running-mate-route-meta"><span>{item.course.areaName} · {item.course.difficulty}</span><span>약 {item.minutes}분</span></div><h3>{item.course.name}</h3><div className="running-mate-route-themes">{item.course.themes.slice(0, 3).map((theme) => <span key={theme}>{theme}</span>)}</div><ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><Link href={`/courses/${item.course.slug}`}>코스 자세히 보기 <span aria-hidden>↗</span></Link></div></article>)}</div> : <div className="mate-empty"><strong>조건에 맞는 등록 코스가 아직 없어요</strong><p>달릴 시간을 늘리거나 지역을 바꿔보세요. 짧은 산책으로 시작해도 좋아요.</p><Link href={`/courses?area=${area.slug}`}>등록 코스 살펴보기 →</Link></div>}
        <p className="mate-footnote">예상 시간은 참고용이며 출발점까지의 이동 시간과 휴식은 제외돼요. 조명·통행·노면 상태는 코스 상세에서 확인해 주세요.</p>
      </section>}
      {panel === 'pace' && <section id="mate-panel-pace" role="tabpanel" aria-labelledby="mate-tab-pace">
        <div className="mate-section-head"><h2>숫자 속 나의 러닝</h2><span>최근 28일 · 최대 30회</span></div>
        <div className="mate-metrics"><div><span>대표 페이스</span><strong>{analysis.paceSec ? paceLabel(analysis.paceSec) : '—'}</strong><small>분·초 / km · 중앙값</small></div><div><span>실제 완주</span><strong>{analysis.count}<small>회</small></strong><small>검증된 GPS 기록</small></div><div><span>평균 거리</span><strong>{analysis.count ? analysis.averageKm.toFixed(1) : '—'}<small>km</small></strong><small>한 번 달릴 때</small></div></div>
        <div className="mate-analysis-card"><span className="mate-eyebrow">PACE NOTE</span><h3>{analysis.count ? '기록을 쌓을수록 더 잘 알게 돼요' : '첫 러닝이 시작점이 돼요'}</h3><p>{paceStory(analysis)}</p><small>체험 러닝과 검증되지 않은 기록은 제외해요. 평균 페이스만으로 체력 변화나 부상 위험을 판단하지 않아요.</small></div>
        <div className="mate-week"><div><span className="mate-eyebrow">WEEKLY CHECK-IN</span><h3>최근 7일, 나의 발자국</h3><p><strong>{analysis.weekKm.toFixed(1)}</strong> km <span>· {analysis.weekRuns}회</span></p></div><div className="mate-week-compare"><span>그 전 7일</span><b>{analysis.previousKm.toFixed(1)} km</b><small>{analysis.weekKm === analysis.previousKm ? '같은 거리를 달렸어요' : `${Math.abs(analysis.weekKm - analysis.previousKm).toFixed(1)}km ${analysis.weekKm > analysis.previousKm ? '더 달렸어요' : '덜 달렸어요'}`}</small></div></div>
        {analysis.recent.length ? <div className="mate-run-list"><h3>분석에 사용한 최근 기록</h3>{analysis.recent.slice(0, 5).map((run) => <div key={run.id}><span><strong>{run.course.name}</strong><small>{new Date(run.startedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })} · {(run.distanceM / 1000).toFixed(1)}km</small></span><b>{paceLabel(run.durationSec / (run.distanceM / 1000))}<small>/km</small></b></div>)}</div> : <div className="mate-empty"><p>기록은 달리기를 마치면 자동으로 연결돼요.</p><Link href={`/courses?area=${area.slug}`}>첫 코스 고르기 →</Link></div>}
      </section>}
      {panel === 'chat' && <section id="mate-panel-chat" role="tabpanel" aria-labelledby="mate-tab-chat">
        <div className="mate-section-head"><h2>{mate.name}에게 물어보세요</h2><button type="button" className="mate-text-button" disabled={asking || !messages.length} onClick={() => { setMessages([]); setSpeech(''); setChatNotice(''); }}>대화 지우기</button></div>
        <p className="mate-chat-explainer">{!data.aiEnabled ? '지금은 기록 기반 안내를 이용할 수 있어요. 생성형 AI 대화는 준비 중이에요.' : data.profile.isAuthenticated ? '질문과 러닝 요약을 AI가 참고해요. GPS 좌표와 계정 정보는 보내지 않아요.' : <>지금은 기록 기반 안내를 이용할 수 있어요. <Link href="/login">로그인</Link>하면 AI와 자유롭게 이야기해요.</>}</p>
        <div className="mate-quick-questions">{PROMPTS.map((prompt) => <button type="button" disabled={asking} key={prompt} onClick={() => void ask(prompt)}>{prompt} ↗</button>)}</div>
        <div className="mate-chat-log" role="log" aria-live="polite" aria-label="메이트와의 대화">{!messages.length && <div className="mate-chat-welcome"><MateAvatar mateId={mate.id} decorative/><p>작은 궁금증도 좋아요.<br/>{mate.name}{mate.id === 'bori' ? '이' : '가'} 같이 살펴볼게요.</p></div>}{messages.map((message) => <div key={message.id} className={`mate-chat-message ${message.role}`}>
          {message.role === 'assistant' && <MateAvatar mateId={message.mateId} decorative/>}<div>{message.role === 'assistant' && <span>{mateById(message.mateId).name} <small>{message.source === 'AI' ? 'AI 답변' : '기록 기반 안내'}</small></span>}<p>{message.text}</p></div></div>)}{asking && <div className="mate-thinking" role="status"><span/><span/><span/><p>{mate.name}{mate.id === 'bori' ? '이' : '가'} 생각하고 있어요</p></div>}<div ref={chatEnd}/></div>
        {chatNotice && <p className="mate-chat-notice" role="status">{chatNotice}</p>}
        <form className="mate-chat-form" onSubmit={submit}><label className="mate-sr-only" htmlFor="mate-question">메이트에게 질문</label><input id="mate-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="오늘의 러닝, 궁금한 게 있나요?" maxLength={300} autoComplete="off" disabled={asking}/><button type="submit" disabled={asking || !question.trim()} aria-label="질문 보내기">↑</button></form><p className="mate-footnote">AI 답변은 틀릴 수 있어요. 기록과 코스 상세를 함께 확인해 주세요. 대화는 이 화면을 나가면 지워져요.</p>
      </section>}
      <section id="feedback" className="mate-feedback"><div className="mate-section-head"><div><span className="mate-eyebrow">AFTER YOUR RUN</span><h2>달리고 나니 어땠나요?</h2></div></div>{analysis.latest ? <><p>{analysis.latest.course.name} · {(analysis.latest.distanceM / 1000).toFixed(1)}km</p><div className="mate-chips">{EFFORTS.map((effort) => <button key={effort.value} type="button" aria-pressed={feedback[analysis.latest!.id]?.effort === effort.value} onClick={() => saveFeedback(analysis.latest!.id, { effort: effort.value })}>{effort.label}</button>)}</div><div className="mate-feedback-course"><span>이 코스는 마음에 들었나요?</span><button type="button" aria-pressed={feedback[analysis.latest.id]?.liked === true} onClick={() => saveFeedback(analysis.latest!.id, { liked: true })}>좋았어요</button><button type="button" aria-pressed={feedback[analysis.latest.id]?.liked === false} onClick={() => saveFeedback(analysis.latest!.id, { liked: false })}>다른 곳이 좋아요</button></div><small>{feedback[analysis.latest.id] ? '피드백을 다음 추천에 반영했어요. 이 기기에 저장돼요.' : '느낀 난이도와 취향을 알려주면 다음 추천에 반영해요.'}</small></> : <p>첫 실제 러닝을 마치면 여기에 기록이 나타나요.<br/>달린 뒤의 느낌까지 들려주세요.</p>}</section>
    </>}
    <footer className="running-mate-footer"><span>LOCAL STRIDE</span><p>잘 달리는 것보다, 함께 오래 달리는 것.</p></footer>
  </main>;
}
