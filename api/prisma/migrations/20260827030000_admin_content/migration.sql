CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "PartnerStatus" AS ENUM ('COMING_SOON', 'ACTIVE', 'DEMO', 'HIDDEN');

ALTER TABLE "User"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Course" ADD COLUMN "thumbnailUrl" TEXT;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_userId_idx" ON "AdminSession"("userId");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Banner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Banner_isActive_sortOrder_idx" ON "Banner"("isActive", "sortOrder");

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "addr" TEXT,
  "offerTitle" TEXT NOT NULL,
  "discountKrw" INTEGER,
  "validUntil" TIMESTAMP(3),
  "status" "PartnerStatus" NOT NULL DEFAULT 'COMING_SOON',
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Partner_status_sortOrder_idx" ON "Partner"("status", "sortOrder");

INSERT INTO "Banner" ("id", "title", "subtitle", "imageUrl", "linkUrl", "sortOrder", "isActive") VALUES
  ('banner-runnerstay-wellness', '달린 뒤, 제대로 회복하세요', '수성구 파동 러너 웰니스 센터 · 러너스테이', '/banners/runnerstay-wellness.svg', NULL, 10, true),
  ('banner-local-discovery', '오늘의 러닝이 여행이 되는 순간', '수성못 코스와 로컬 스폿을 함께 만나보세요', '/banners/local-discovery.svg', '/courses/suseong-blue-5k', 20, true);

INSERT INTO "Partner" ("id", "name", "category", "addr", "offerTitle", "status", "sortOrder") VALUES
  ('partner-runnerstay-padong', '러너스테이', '러너 웰니스 센터', '대구광역시 수성구 용학로 12-1, 1층', '완주 러너 제휴 혜택 준비 중', 'COMING_SOON', 10),
  ('partner-demo-cafe', '수성못 카페거리 제휴 후보 카페', '카페', '대구 수성구 용학로', '리커버리 커피 10% 할인', 'DEMO', 20),
  ('partner-demo-food', '들안길 먹거리타운 제휴 후보 매장', '음식점', '대구 수성구 들안로 일대', '들안길 먹거리타운 5,000원 할인', 'DEMO', 30);
