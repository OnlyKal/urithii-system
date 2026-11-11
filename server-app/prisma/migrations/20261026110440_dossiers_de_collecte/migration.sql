-- AlterTable
ALTER TABLE "CulturalItem" ADD COLUMN "dossierId" TEXT;
ALTER TABLE "CulturalItem" ADD COLUMN "dossierUnit" TEXT;

-- CreateTable
CREATE TABLE "DossierSectionDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'standard',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "fields" TEXT NOT NULL DEFAULT '[]',
    "entry" TEXT,
    "mediaHint" TEXT,
    "sensitiveNotice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DossierSectionDef_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "communityId" TEXT,
    "proposedCommunityName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "data" TEXT NOT NULL DEFAULT '{}',
    "reviews" TEXT NOT NULL DEFAULT '{}',
    "publication" TEXT NOT NULL DEFAULT '{}',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "collectorId" TEXT NOT NULL,
    "missionId" TEXT,
    "submittedAt" DATETIME,
    "validatedAt" DATETIME,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionDossier_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionDossier_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionDossier_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DossierEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sectionKey" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "comment" TEXT,
    "version" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DossierEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "CollectionDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DossierEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DossierVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "reason" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DossierVersion_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "CollectionDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DossierVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierSectionDef_key_key" ON "DossierSectionDef"("key");

-- CreateIndex
CREATE INDEX "CollectionDossier_status_idx" ON "CollectionDossier"("status");

-- CreateIndex
CREATE INDEX "CollectionDossier_collectorId_idx" ON "CollectionDossier"("collectorId");

-- CreateIndex
CREATE INDEX "CollectionDossier_communityId_idx" ON "CollectionDossier"("communityId");

-- CreateIndex
CREATE INDEX "DossierEvent_dossierId_idx" ON "DossierEvent"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "DossierVersion_dossierId_version_key" ON "DossierVersion"("dossierId", "version");

-- CreateIndex
CREATE INDEX "CulturalItem_dossierId_idx" ON "CulturalItem"("dossierId");
