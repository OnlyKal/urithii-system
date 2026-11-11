-- CreateTable
CREATE TABLE "GameMission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "rewardXp" INTEGER NOT NULL DEFAULT 100,
    "badge" TEXT,
    "communityId" TEXT,
    "contentRefs" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameMission_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "mission" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "GameMission_slug_key" ON "GameMission"("slug");

-- CreateIndex
CREATE INDEX "GameMission_status_idx" ON "GameMission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GameStat_day_event_mission_key" ON "GameStat"("day", "event", "mission");

