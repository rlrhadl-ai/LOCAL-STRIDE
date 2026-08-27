# LOCAL STRIDE — 달리면서 여행하는 도시, 대구

러닝 코스를 따라 관광·소비·경험이 연결되는 대구 특화 러닝 관광 플랫폼.
운동 → 관광 발견 → 로컬 소비 → 재방문의 루프를 GPS·공공데이터·AI로 자동화한다.

```
web/   Next.js 15 (App Router) · Vercel 배포        — 모바일 웹(PWA) UI
api/   Express + Prisma + PostgreSQL · AWS EC2(pm2)  — 공공데이터 프록시·캐시, 러닝/보상/크루/대회/메이트 API, 라이브 랭킹(Socket.IO)
docs/  아키텍처 · 데이터 모델 · API · 공공데이터 · 로드맵 · 데모데이용 단일 HTML(demo-v2.html)
```

## 무엇이 들어 있나

| 모듈 | 상태 | 내용 |
|---|---|---|
| 코스 추천 | ✅ | 거리·테마·날씨·일몰 규칙 점수 + 추천 이유 3줄 (`GET /api/recommend`) |
| 코스 빌더 | ✅ | 지도에서 경유지 클릭 → 거리·체크포인트 자동, 경로 주변 관광지 TourAPI 자동 첨부 (`POST /api/courses`) |
| 러닝 루프 | ✅ | 데모 GPS 재생 / 실제 GPS, 120m 반경 자동 체크인, 반경 500m 관광 디스커버리 푸시 + 음성 가이드(TTS) |
| 공공데이터 | ✅ | TourAPI 4.0 `locationBasedList2`·`detailCommon2`·`searchFestival2`, 기상청 초단기실황, 에어코리아 — 키 없으면 SEED 폴백 + 화면에 LIVE/SEED 표시 |
| 완주 보상 | ✅ | GPS 검증 → 메달 · 로컬 쿠폰 · 챌린지(대구 5대 코스) · 미션 진행 · MY RECORD 카드(PNG) |
| 미션 | ✅ | 기간별 누적 거리, 미라클 런(05~08시), 체크인 올클리어, 로컬 맛집 인증(사진+위치, 가맹점 200m) |
| 크루(모임) | ✅ | 라이프스타일·페이스대 필터, 생성/참여, 정기 러닝 일정, 오픈채팅 링크 |
| 대회 | ✅ | 등록·티셔츠 사이즈·배번, 라이브 랭킹 전광판(Socket.IO + 폴링 폴백) — 결제(토스)는 2단계 |
| 러닝 메이트 | ✅ | 거리/코스 베스트 랭킹(이상치 필터), 페이스메이커·메이트 모집/신청 — 월별 자동 매칭은 2단계 |
| 익명제 | 🔜 | 닉네임 공개 프로필은 지금, 카카오 로그인 + 휴대폰 인증은 2단계 (지금은 기기 ID 익명 계정) |
| AI 동반자 | ✅ | 러너 위치 반경 관광지 컨텍스트 + Claude Haiku 한 문장 답변 + TTS (키 없으면 규칙 답변) |
| 관리자 | ✅ | 허용 이메일 기반 가입·로그인·로그아웃, 회원·코스·관광지·혜택·홈 배너 관리, 이미지 업로드 (`/admin`) |

## 관리자 콘솔

`/admin/signup`에서 허용된 이메일과 서버의 `ADMIN_SETUP_CODE`로 최초 관리자 계정을 만든다. 가입 후에는 `/admin/login`에서 이메일·비밀번호로 로그인한다. 운영 서버에는 `ADMIN_EMAILS`, `ADMIN_SETUP_CODE`, 영구 이미지 경로인 `UPLOAD_DIR`을 설정해야 한다. 비밀번호 원문과 세션 토큰은 데이터베이스에 저장하지 않는다.

## 빠른 시작 (로컬)

요구: Node 20+, Docker(또는 PostgreSQL 16), 공공데이터포털 계정(선택 — 없어도 SEED 데이터로 전부 동작)

```bash
# 1) DB
docker compose up -d                      # localhost:5432, user/pw/db = localstride

# 2) API
cd api
cp .env.example .env                      # DATABASE_URL 은 docker 기본값과 일치. 키는 있으면 채우기
npm install
npx prisma migrate dev                    # prisma/migrations 적용 (init 포함)
npm run db:seed                           # 수성못 블루런 5K 등 4코스, POI, 메달, 미션, 대회, 크루 시드
npm run dev                               # http://localhost:4000/api/health

# 3) WEB (새 터미널)
cd web
cp .env.example .env.local                # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                               # http://localhost:3000
```

`http://localhost:4000/api/health` 의 `integrations` 로 어떤 키가 살아 있는지 확인할 수 있다.

## 공공데이터 키 (실데이터 시연)

공공데이터포털(data.go.kr)에서 아래 3개를 활용신청하고 **Decoding 키**를 `api/.env` 에 넣는다. 계정 하나로 키는 같고, API 마다 활용신청만 하면 된다.

| 환경변수 | 서비스 | 용도 |
|---|---|---|
| `TOURAPI_KEY` | 한국관광공사_국문 관광정보 서비스_GW (TourAPI 4.0, `KorService2`) | 반경 500m 관광지·음식점 디스커버리, 개요(음성 가이드), 축제 |
| `KMA_KEY` | 기상청_단기예보 조회서비스 | 홈 날씨 카드(초단기실황) |
| `AIRKOREA_KEY` | 한국환경공단_에어코리아_대기오염정보 | 미세먼지 등급 |

키를 넣으면 앱의 배지가 `저장 데이터` → `LIVE · TourAPI 412ms` 로 바뀌고, 러닝 화면에서 배지를 누르면 원본 JSON 첫 항목이 보인다. 상세는 `docs/public-data.md`.

## 배포

**web → Vercel**: 저장소 연결 후 Root Directory 를 `web` 으로, 환경변수 `NEXT_PUBLIC_API_URL=https://api.<도메인>`. main 푸시마다 자동 배포.

**api → AWS EC2 (나중에)**: TEAMPL 과 같은 패턴.
```bash
git pull && cd api && npm ci && npx prisma migrate deploy && npm run build
pm2 start ecosystem.config.cjs   # 이후엔 pm2 restart localstride-api --update-env
```
- RDS PostgreSQL 16 에 `DATABASE_URL` 연결, `CORS_ORIGINS=https://<web도메인>` (`*.vercel.app` 프리뷰는 기본 허용)
- 실제 GPS·위치 권한은 https 에서만 나오므로 API 도 `api.<도메인>` + nginx + certbot 으로 https 를 붙인다
- Socket.IO 를 쓰므로 nginx 에서 `Upgrade`/`Connection` 헤더를 넘겨야 한다 (docs/architecture.md 에 설정 예시)

## 데모데이

발표용 단일 파일 데모(`docs/demo-v2.html`)는 서버 없이 열린다. 플랫폼 URL 로 시연할 때는 홈 → 러닝 시작(데모 GPS ×2) → 완주 순서로 약 30초.
키보드: `→` 다음 체크포인트 · `Space` 일시정지 · `F` 완주 · `M` 음성 · `1/2/4` 속도.

## 로드맵

- **0 (데모데이)**: 위 표의 ✅ 전부. 실데이터는 키만 넣으면 됨
- **1 (데모 후 4~6주)**: 카카오 로그인 + 휴대폰 OTP(익명제), 카카오맵 전환, 대회 결제(토스)·운영자 기록 입력, 코스 빌더 GPX 업로드, S3 사진 업로드, 3KM CHALLENGE 전광판 통합
- **2**: 월별 러닝 메이트 자동 매칭, 로컬 맛집 인증 AI 검수, 운동법 콘텐츠, React Native 앱, 제휴 정산

자세한 내용은 `docs/roadmap.md`.
