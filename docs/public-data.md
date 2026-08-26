# 공공데이터

## 활용신청 (data.go.kr)
1. 한국관광공사_국문 관광정보 서비스_GW — TourAPI 4.0 (`https://apis.data.go.kr/B551011/KorService2`). 개발계정 일일 트래픽이 있으므로 캐시 필수(이미 `Poi` 테이블에 캐시).
2. 기상청_단기예보 조회서비스 — `VilageFcstInfoService_2.0/getUltraSrtNcst` (격자 nx/ny 는 `lib/geo.ts` 의 변환식, 수성못 ≈ 89/90)
3. 한국환경공단_에어코리아_대기오염정보 — `ArpltnInfoInqireSvc/getCtprvnRltmMesureDnsty` (sidoName=대구, 수성동 측정소 우선)

`.env` 에는 **Decoding 키**를 넣는다. 코드가 `encodeURIComponent` 로 한 번만 인코딩하므로 Encoding 키를 넣으면 이중 인코딩으로 `SERVICE_KEY_IS_NOT_REGISTERED` 가 난다.

## 호출과 폴백
- `api/src/lib/tourapi.ts` — 실패·미설정 시 DB 의 SEED/캐시 POI 로 폴백하고 응답에 `source: 'SEED'`, `error` 를 넣는다. UI 배지가 LIVE/저장 데이터를 구분해 보여준다.
- 응답 `raw` 에 첫 번째 원본 item 을 실어 시연 중 "진짜 호출"임을 보여줄 수 있다 (러닝 화면 TourAPI 배지 클릭).

## 파일 데이터 (CSV → 시드)
대구 관광코스 36건 · 수성구 자전거도로 73건 · 수성구 체육시설 615건 은 체크포인트의 `dataSource` 문구와 코스 구성 근거로 쓰였다.
CSV 를 그대로 DB 에 넣으려면 `prisma/seed.ts` 에 `csv-parse` 로 읽어 `Checkpoint`/`Merchant` 로 upsert 하는 블록을 추가하면 된다.

## 주의
- TourAPI 파라미터명은 KorService2 기준(`mapX`=경도, `mapY`=위도, `radius`, `arrange=E` 거리순). 응답 `dist` 는 m.
- 축제(`searchFestival2`)는 `eventStartDate=YYYYMMDD`, `areaCode=4`(대구).
- `detailCommon2` 의 `overview` 는 HTML 이 섞여 있어 태그를 제거해 저장한다.
