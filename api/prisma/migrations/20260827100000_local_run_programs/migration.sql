CREATE TYPE "EventKind" AS ENUM ('RACE', 'MORNING', 'AFTER_WORK', 'INDEPENDENT', 'THEME', 'POPUP');
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

ALTER TABLE "Event"
  ADD COLUMN "kind" "EventKind" NOT NULL DEFAULT 'RACE',
  ADD COLUMN "place" TEXT,
  ADD COLUMN "paceSec" INTEGER,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "hostId" TEXT;

ALTER TABLE "EventRegistration"
  ADD COLUMN "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN "checkedInAt" TIMESTAMP(3);

CREATE INDEX "Event_kind_status_startsAt_idx" ON "Event"("kind", "status", "startsAt");
CREATE INDEX "Event_hostId_idx" ON "Event"("hostId");

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
