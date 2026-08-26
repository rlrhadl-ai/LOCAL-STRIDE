# 아키텍처

```
[모바일 웹 · PWA]  Next.js 14 App Router ─── Vercel (https, 자동 배포)
        │  fetch  x-device-id                │ socket.io-client (/live)
        ▼                                    ▼
[API]  Express + Prisma(engineType=client, pg adapter) + Socket.IO ─── AWS EC2 (pm2 localstride-api, nginx https)
        │                          │                       │
        ▼                          ▼                       ▼
[RDS PostgreSQL 16]     [공공데이터포털]            [Anthropic API]
 코스·POI 캐시·러닝·보상   TourAPI 4.0 KorService2      AI 동반자 (Claude Haiku)
 미션·크루·대회·메이트      기상청 초단기실황 / 에어코리아
```

## 왜 API 서버를 따로 두나
- 공공데이터 키·Anthropic 키를 서버에만 둔다 (프론트에 노출 금지)
- TourAPI 응답을 `Poi` 테이블에 캐시해 일일 트래픽 한도를 아끼고, 오프라인/장애 시 SEED 폴백
- 라이브 랭킹(Socket.IO), 사진 업로드(S3, 2단계), 랭킹 집계·축제 동기화 크론
- Vercel 서버리스에서 RDS 커넥션을 직접 잡으면 풀 고갈 위험 → EC2 상주 프로세스 + pg 풀(기본 10)

## 요청 흐름 (러닝 한 바퀴)
1. `POST /api/runs` — 러닝 생성, 출발 체크포인트 자동 체크인, 코스(체크포인트·코스 POI·폴리라인) 반환
2. 클라이언트 엔진(`web/lib/useRunEngine.ts`)이 250m 이동마다 `GET /api/tour/nearby` → TourAPI `locationBasedList2` (없으면 SEED)
3. 반경 진입 시 푸시 카드 + TTS, 체크포인트 120m 진입 시 `POST /api/runs/:id/checkin`
4. 3초마다 궤적 `POST /api/runs/:id/track` (서버가 거리 계산, 4m 미만 노이즈·7m/s 초과 점프 무시)
5. `POST /api/runs/:id/finish` → `services/finish.ts`: 검증 → 메달 → 쿠폰 → 챌린지 → 미션 → 요약 반환

## 안전장치
- 완주 검증: 페이스 2'30"/km 미만·25분/km 초과·궤적 부족(LIVE)이면 `valid=false` — 기록은 남지만 랭킹·메달 제외
- 익명 계정: `x-device-id` 로 자동 생성. 2단계에서 카카오 로그인 + 휴대폰 OTP 로 같은 User 에 `kakaoId`·`phoneVerified` 를 채운다 (테이블 변경 없음)
- SES 교훈: 폴링 대신 Socket.IO, 소켓 실패 시에만 5초 폴링. Prisma 는 싱글턴 + 풀 제한

## nginx (EC2, https + websocket)
```
server {
  server_name api.localstride.kr;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $connection_upgrade; proxy_set_header Connection "upgrade";
    proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme;
  }
}
# certbot --nginx -d api.localstride.kr
```

## 카카오맵 전환 (1단계)
`web/components/RunMap.tsx`·`BuilderMap.tsx` 만 교체하면 된다. 나머지는 좌표 배열만 넘긴다. `NEXT_PUBLIC_KAKAO_MAP_KEY` 는 이미 env 에 자리를 잡아 두었다.
