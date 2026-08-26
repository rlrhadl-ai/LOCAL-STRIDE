# 데이터 모델 (api/prisma/schema.prisma)

| 영역 | 모델 | 메모 |
|---|---|---|
| 사용자 | `User` | `deviceId`(익명) · `kakaoId` · `phoneVerified` · 공개 `nickname` (익명제) |
| 코스 | `Course` `Checkpoint` `Poi` `CoursePoi` | `polyline` JSON [[lat,lng]], 체크포인트 `radiusM` 기본 120, `Poi` 는 TourAPI `contentid` 기준 캐시(`source` TOURAPI/SEED) |
| 러닝 | `Run` `Checkin` | `mode` DEMO/LIVE, `track` JSON, `valid`/`invalidReason` 검증 결과 |
| 보상 | `Medal` `UserMedal` `Merchant` `Coupon` `UserCoupon` `Challenge` `UserChallenge` | 메달·쿠폰은 `courseSlug` 로 코스에 연결, 챌린지는 `courseSlugs[]` |
| 미션 | `Mission` `MissionProgress` | `type` CHECKIN / PERIOD_DISTANCE / MIRACLE_RUN / LOCAL_FOOD / WORKOUT, `rule` JSON |
| 크루 | `Crew` `CrewMember` `CrewRun` | `lifestyle[]` 태그, 페이스대(초/km), 오픈채팅 링크 |
| 대회 | `Event` `EventRegistration` `EventResult` | 배번·티셔츠·결제 플래그, 결과는 라이브 랭킹 소스 |
| 메이트 | `MatePost` `MateApplication` | PACEMAKER / MATE, 정원 |

## 좌표·반경
lat/lng Float + bbox 프리필터 + haversine. 수십만 POI 이상이 되면 PostGIS 로 전환:
```sql
CREATE EXTENSION postgis; ALTER TABLE "Poi" ADD COLUMN geom geography(Point,4326);
UPDATE "Poi" SET geom = ST_MakePoint(lng, lat)::geography; CREATE INDEX poi_geom ON "Poi" USING GIST(geom);
```

## 마이그레이션
`prisma/migrations/20260826000000_init` 이 초기 스키마. 변경은 `npx prisma migrate dev --name <이름>`, 운영은 `npx prisma migrate deploy`.
Prisma 는 `engineType = "client"` (Rust 엔진 없음) + `@prisma/adapter-pg`. 시드는 `npm run db:seed` (여러 번 실행해도 안전).
