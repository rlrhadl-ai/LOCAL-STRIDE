# 로드맵

## 0 — 데모데이 (지금 저장소)
- 코스 추천·빌더, 러닝 루프(디스커버리 푸시·자동 체크인·음성), 완주 보상(메달·쿠폰·챌린지·미션·MY RECORD)
- 크루·대회(라이브 랭킹)·메이트 랭킹/모집·AI 동반자
- 공공데이터 3종 실호출(키만 넣으면 LIVE), SEED 폴백
- 실제 GPS 는 https(Vercel) 에서만. 시연은 데모 GPS ×2 권장

## 1 — 데모 후 4~6주
- 익명제: 카카오 로그인 + 휴대폰 OTP(쿨SMS/NCP SENS). `User.kakaoId`·`phoneVerified` 이미 준비됨. 크루·대회·메이트 신청은 인증 사용자만
- 지도: 카카오맵 JS SDK 로 교체(`RunMap`·`BuilderMap`)
- 대회: 토스 결제 웹훅 → `EventRegistration.paid`, 운영자 기록 일괄 입력(CSV/QR), 3KM CHALLENGE 전광판·MY RECORD 통합
- 코스: GPX 업로드, 현장 답사 좌표로 수성못 폴리라인 교체, 고도 데이터
- 미션: S3 사진 업로드(presigned URL), 로컬 맛집 인증 → 쿠폰 정산 근거
- 운영: EC2 nginx https, RDS, pm2, GitHub Actions 로 EC2 배포 자동화

## 2 — 그 이후
- 월별 러닝 메이트 자동 매칭(페이스·지역·시간대 — TEAMPL 매칭 로직 재활용)
- 로컬 맛집 인증 AI 검수(Claude vision), 운동법 콘텐츠
- 시즌 한정 코스·메달 자동 생성(searchFestival2), 부산·강릉·전주 코스 확장
- React Native(Expo) 앱: 백그라운드 GPS, 푸시 알림
- 제휴 정산·스폰서십 대시보드(B2G/B2B)
