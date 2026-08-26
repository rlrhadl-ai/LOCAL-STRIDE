export default function LiveBadge({ source, ms, label }: { source?: string; ms?: number; label?: string }) {
  const live = source === 'TOURAPI' || source === 'KMA' || source === 'AIRKOREA' || source === 'CLAUDE';
  return <span className={`live-badge ${live ? '' : 'seed'}`}><i />{live ? `LIVE · ${label ?? source}${ms != null ? ` ${ms}ms` : ''}` : `${label ?? '저장 데이터'}${source ? ` · ${source}` : ''}`}</span>;
}
