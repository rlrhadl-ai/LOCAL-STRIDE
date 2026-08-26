# API

모든 경로는 `/api` 아래. 사용자 식별은 `x-device-id` 헤더(웹이 자동 생성). 응답은 JSON, 오류는 `{ error }`.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | DB 카운트 + 어떤 외부 키가 설정됐는지 |
| GET | `/tour/nearby?lat&lng&radius=500&type=12&limit=20` | TourAPI locationBasedList2 (캐시·SEED 폴백). `source`, `fetchedMs`, `raw` |
| GET | `/tour/detail/:contentId` | detailCommon2 개요 (음성 가이드·AI 컨텍스트) |
| GET | `/tour/festivals?from=YYYY-MM-DD` | searchFestival2 (대구 areaCode 4) |
| GET | `/weather/now?lat&lng` | 기상청 초단기실황 + 에어코리아 + 일몰 |
| GET | `/courses?theme&km&mine` | 코스 목록 |
| GET | `/courses/:idOrSlug` | 코스 + 체크포인트 + 코스 POI |
| POST | `/courses` | 코스 빌더 `{ name, themes[], difficulty, points[[lat,lng]], checkpointEveryM }` — 관광지 자동 첨부 |
| GET | `/recommend?km&themes=수변,야경&lat&lng` | 규칙 기반 추천 + 이유 |
| POST | `/runs` | 러닝 시작 `{ courseId, mode }` |
| GET | `/runs/:id` | 러닝 + 체크인 + 메달 + 쿠폰 |
| POST | `/runs/:id/track` | 궤적 추가 `{ points: [{lat,lng,t}] }` |
| POST | `/runs/:id/checkin` | 체크인 `{ checkpointId, lat, lng, method }` — LIVE 는 반경 검증 |
| POST | `/runs/:id/finish` | 완주 `{ durationSec, distanceM? }` → 검증·보상 요약 |
| GET | `/missions` · POST `/missions/:code/proof` | 진행 중 미션 / 로컬 맛집 인증 `{ lat, lng, photoUrl? }` |
| GET | `/medals` | 메달 컬렉션 + 챌린지 진행 |
| GET/POST | `/crews` · GET `/crews/:id` · POST `/crews/:id/join|leave|runs` | 크루 |
| GET | `/events` · `/events/:id` · `/events/:id/ranking` | 대회, 랭킹(폴링 폴백) |
| POST | `/events/:id/register` · `/events/:id/results` | 참가 등록 `{ tshirtSize }` / 기록 `{ timeSec, distanceM }` → 소켓 브로드캐스트 |
| GET/POST | `/mates` · POST `/mates/:id/apply` | 페이스메이커·메이트 모집 |
| GET | `/rankings?period=week|month|all&courseId` | 거리 랭킹 + 코스 베스트 (valid 만) |
| GET/PATCH | `/me` · GET `/me/runs` · POST `/me/coupons/:code/use` | 프로필·통계·쿠폰 |
| POST | `/ai/ask` | `{ question, lat, lng, courseName?, distanceM? }` → Claude/규칙 답변 + 컨텍스트 |

Socket.IO: 네임스페이스 `/live`, `join(eventId)` → `ranking` 이벤트로 배열 수신.
