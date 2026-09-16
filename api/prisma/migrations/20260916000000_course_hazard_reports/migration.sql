CREATE TYPE "HazardCategory" AS ENUM ('SURFACE','FACILITY','OBSTRUCTION','LIGHTING','OTHER');
CREATE TYPE "HazardSeverity" AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TYPE "HazardStatus" AS ENUM ('RECEIVED','CONFIRMED','IN_PROGRESS','RESOLVED','HIDDEN');
CREATE TABLE "HazardReport" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "courseId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  "category" "HazardCategory" NOT NULL, "severity" "HazardSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "HazardStatus" NOT NULL DEFAULT 'RECEIVED', "description" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL, "lng" DOUBLE PRECISION NOT NULL, "accuracyM" DOUBLE PRECISION,
  "locationSource" TEXT NOT NULL, "photo" BYTEA NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "publicNote" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "HazardReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HazardReport_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HazardReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HazardReport_coordinate_check" CHECK ("lat" BETWEEN 33 AND 39 AND "lng" BETWEEN 124 AND 132),
  CONSTRAINT "HazardReport_locationSource_check" CHECK ("locationSource" IN ('GPS','MAP'))
);
CREATE UNIQUE INDEX "HazardReport_requestId_key" ON "HazardReport"("requestId");
CREATE INDEX "HazardReport_courseId_status_createdAt_idx" ON "HazardReport"("courseId","status","createdAt");
CREATE INDEX "HazardReport_status_category_createdAt_idx" ON "HazardReport"("status","category","createdAt");
CREATE TABLE "HazardReportHistory" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "adminId" TEXT NOT NULL, "status" "HazardStatus" NOT NULL,
  "note" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HazardReportHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HazardReportHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "HazardReport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HazardReportHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HazardReportHistory_reportId_createdAt_idx" ON "HazardReportHistory"("reportId","createdAt");
