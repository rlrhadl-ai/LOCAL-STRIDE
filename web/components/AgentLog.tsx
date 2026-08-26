'use client';
export type LogKind = 'sense' | 'decide' | 'act' | 'learn';
export interface LogEntry { t: string; kind: LogKind; text: string }
const K: Record<LogKind, string> = { sense: '감지', decide: '판단', act: '실행', learn: '학습' };
export default function AgentLog({ entries, children }: { entries: LogEntry[]; children?: React.ReactNode }) {
  return (
    <div className="agent-log">
      <h3><span>AGENT LOOP</span><span>감지 → 판단 → 실행 → 학습</span></h3>
      <ol>{entries.length === 0 ? <li style={{ gridTemplateColumns: '1fr', color: '#A9BBE3' }}>러닝을 시작하면 에이전트 판단 과정이 기록됩니다.</li> : entries.map((e, i) => <li key={i}><time>{e.t}</time><span className={`k-${e.kind}`}>{K[e.kind]}</span><span>{e.text}</span></li>)}</ol>
      {children}
    </div>
  );
}
