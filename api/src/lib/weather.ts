/**
 * 기상청 초단기실황(getUltraSrtNcst) + 에어코리아 시도별 실시간 측정 — 키가 없으면 시연값
 */
import { toKmaGrid, sunsetKst } from './geo';

const KMA_KEY = process.env.KMA_KEY || '';
const AIR_KEY = process.env.AIRKOREA_KEY || '';

export interface WeatherNow {
  source: 'KMA' | 'DEMO';
  airSource: 'AIRKOREA' | 'DEMO';
  temp: number;
  humidity: number;
  windMs: number;
  rainType: string; // 없음 / 비 / 눈 …
  sky: string; // 초단기실황엔 하늘상태가 없어서 강수형태 기준으로 추정
  pm10: number | null;
  pm10Grade: string; // 좋음 / 보통 / 나쁨 / 매우나쁨
  sunset: string;
  fetchedAt: string;
  error?: string;
}

const DEMO: Omit<WeatherNow, 'sunset' | 'fetchedAt'> = { source: 'DEMO', airSource: 'DEMO', temp: 24, humidity: 54, windMs: 1.2, rainType: '없음', sky: '맑음', pm10: 22, pm10Grade: '좋음' };

function baseDateTime(now = new Date()) {
  // 초단기실황은 매시 40분 이후 해당 시각 자료가 나온다 → 40분 전이면 직전 시각
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  if (kst.getUTCMinutes() < 40) kst.setUTCHours(kst.getUTCHours() - 1);
  const ymd = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const hh = String(kst.getUTCHours()).padStart(2, '0') + '00';
  return { base_date: ymd, base_time: hh };
}

export async function weatherNow(lat: number, lng: number): Promise<WeatherNow> {
  const out: WeatherNow = { ...DEMO, sunset: sunsetKst(lat, lng), fetchedAt: new Date().toISOString() };
  if (KMA_KEY) {
    try {
      const { nx, ny } = toKmaGrid(lat, lng);
      const { base_date, base_time } = baseDateTime();
      const q = new URLSearchParams({ pageNo: '1', numOfRows: '20', dataType: 'JSON', base_date, base_time, nx: String(nx), ny: String(ny) });
      const res = await fetch(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(KMA_KEY)}&${q}`, { signal: AbortSignal.timeout(6000) });
      const json: any = await res.json();
      const items: any[] = json?.response?.body?.items?.item ?? [];
      const get = (c: string) => items.find((i) => i.category === c)?.obsrValue;
      if (items.length) {
        out.source = 'KMA';
        out.temp = Number(get('T1H') ?? out.temp);
        out.humidity = Number(get('REH') ?? out.humidity);
        out.windMs = Number(get('WSD') ?? out.windMs);
        const pty = String(get('PTY') ?? '0');
        out.rainType = { '0': '없음', '1': '비', '2': '비/눈', '3': '눈', '5': '빗방울', '6': '빗방울눈날림', '7': '눈날림' }[pty] ?? '없음';
        out.sky = pty === '0' ? '맑음' : '강수';
      } else out.error = `KMA: ${json?.response?.header?.resultMsg ?? 'no items'}`;
    } catch (e: any) { out.error = `KMA 실패 — ${e.message}`; }
  }
  if (AIR_KEY) {
    try {
      const q = new URLSearchParams({ returnType: 'json', numOfRows: '30', pageNo: '1', sidoName: '대구', ver: '1.3' });
      const res = await fetch(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodeURIComponent(AIR_KEY)}&${q}`, { signal: AbortSignal.timeout(6000) });
      const json: any = await res.json();
      const items: any[] = json?.response?.body?.items ?? [];
      const st = items.find((i) => i.stationName === '수성동') ?? items.find((i) => i.pm10Value && i.pm10Value !== '-') ?? items[0];
      if (st) {
        out.airSource = 'AIRKOREA';
        out.pm10 = Number(st.pm10Value) || null;
        out.pm10Grade = ({ '1': '좋음', '2': '보통', '3': '나쁨', '4': '매우나쁨' } as Record<string, string>)[String(st.pm10Grade)] ?? (out.pm10 == null ? '정보없음' : out.pm10 <= 30 ? '좋음' : out.pm10 <= 80 ? '보통' : out.pm10 <= 150 ? '나쁨' : '매우나쁨');
      }
    } catch (e: any) { out.error = (out.error ? out.error + ' / ' : '') + `AirKorea 실패 — ${e.message}`; }
  }
  return out;
}
