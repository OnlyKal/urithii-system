-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN "transformation" TEXT;

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Place_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Place" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isoCode" TEXT,
    "parentId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Language_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fieldsSchema" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "history" TEXT,
    "documentationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "documentationNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunityName" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VARIANT',
    "notes" TEXT,
    "sourceId" TEXT,
    CONSTRAINT "CommunityName_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityName_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityPlace" (
    "communityId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "notes" TEXT,
    "sourceId" TEXT,

    PRIMARY KEY ("communityId", "placeId"),
    CONSTRAINT "CommunityPlace_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommunityPlace_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityLanguage" (
    "communityId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "notes" TEXT,

    PRIMARY KEY ("communityId", "languageId"),
    CONSTRAINT "CommunityLanguage_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "date" TEXT,
    "publisher" TEXT,
    "provenance" TEXT,
    "reference" TEXT,
    "url" TEXT,
    "rights" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResourcePerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "publicName" TEXT,
    "attributionMode" TEXT NOT NULL DEFAULT 'ANONYMOUS',
    "communityId" TEXT,
    "locality" TEXT,
    "contact" TEXT,
    "birthYear" INTEGER,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardianName" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourcePerson_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourcePerson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourcePersonId" TEXT,
    "missionId" TEXT,
    "collectedById" TEXT NOT NULL,
    "collectedAt" DATETIME NOT NULL,
    "canStore" BOOLEAN NOT NULL DEFAULT true,
    "canProcess" BOOLEAN NOT NULL DEFAULT false,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "canTranslate" BOOLEAN NOT NULL DEFAULT false,
    "canReuse" BOOLEAN NOT NULL DEFAULT false,
    "allowsInterview" BOOLEAN NOT NULL DEFAULT true,
    "allowsAudio" BOOLEAN NOT NULL DEFAULT false,
    "allowsVideo" BOOLEAN NOT NULL DEFAULT false,
    "allowsPhoto" BOOLEAN NOT NULL DEFAULT false,
    "allowsTranscription" BOOLEAN NOT NULL DEFAULT false,
    "attribution" TEXT NOT NULL DEFAULT 'ANONYMOUS',
    "restrictions" TEXT,
    "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
    "communityAuthorization" TEXT,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    "documentFileId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Consent_resourcePersonId_fkey" FOREIGN KEY ("resourcePersonId") REFERENCES "ResourcePerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Consent_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consent_documentFileId_fkey" FOREIGN KEY ("documentFileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CulturalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "fields" TEXT,
    "keywords" TEXT,
    "categoryId" TEXT NOT NULL,
    "originalLanguageId" TEXT,
    "dateKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dateValue" TEXT,
    "dateEnd" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "accessLevel" TEXT NOT NULL DEFAULT 'PRIVATE',
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "resourcePersonId" TEXT,
    "missionId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedVersionId" TEXT,
    "publishedAt" DATETIME,
    "scheduledAt" DATETIME,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CulturalItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_originalLanguageId_fkey" FOREIGN KEY ("originalLanguageId") REFERENCES "Language" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_resourcePersonId_fkey" FOREIGN KEY ("resourcePersonId") REFERENCES "ResourcePerson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ItemVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CulturalItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "publicNote" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "ItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemCommunity" (
    "itemId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,

    PRIMARY KEY ("itemId", "communityId"),
    CONSTRAINT "ItemCommunity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemCommunity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemPlace" (
    "itemId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,

    PRIMARY KEY ("itemId", "placeId"),
    CONSTRAINT "ItemPlace_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemSource" (
    "itemId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "supports" TEXT,
    "locator" TEXT,

    PRIMARY KEY ("itemId", "sourceId"),
    CONSTRAINT "ItemSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemMedia" (
    "itemId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,

    PRIMARY KEY ("itemId", "mediaId"),
    CONSTRAINT "ItemMedia_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemConsent" (
    "itemId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,

    PRIMARY KEY ("itemId", "consentId"),
    CONSTRAINT "ItemConsent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemConsent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RELATED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessGrant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "comments" TEXT,
    "requestedChanges" TEXT,
    "version" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationDecision_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ValidationDecision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalFileId" TEXT NOT NULL,
    "webFileId" TEXT,
    "thumbnailFileId" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'PRIVATE',
    "consentId" TEXT,
    "publicationCleared" BOOLEAN NOT NULL DEFAULT false,
    "rightsStatement" TEXT,
    "credit" TEXT,
    "dateKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dateValue" TEXT,
    "placeId" TEXT,
    "peopleDepicted" TEXT,
    "context" TEXT,
    "provenance" TEXT,
    "missionId" TEXT,
    "collectedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaAsset_originalFileId_fkey" FOREIGN KEY ("originalFileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_webFileId_fkey" FOREIGN KEY ("webFileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_thumbnailFileId_fkey" FOREIGN KEY ("thumbnailFileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TextDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "mediaId" TEXT,
    "itemId" TEXT,
    "translationOfId" TEXT,
    "languageId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "translatorRole" TEXT,
    "notes" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TextDocument_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TextDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TextDocument_translationOfId_fkey" FOREIGN KEY ("translationOfId") REFERENCES "TextDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TextDocument_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TextDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TextRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TextRevision_textId_fkey" FOREIGN KEY ("textId") REFERENCES "TextDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TextRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "communityId" TEXT,
    "placeId" TEXT,
    "categoryIds" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "responsibleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "requiredDocuments" TEXT,
    "safetyGuidelines" TEXT,
    "expectedResults" TEXT,
    "budget" TEXT,
    "difficulties" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "Mission_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionMember" (
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLLECTEUR',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("missionId", "userId"),
    CONSTRAINT "MissionMember_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionResourcePerson" (
    "missionId" TEXT NOT NULL,
    "resourcePersonId" TEXT NOT NULL,

    PRIMARY KEY ("missionId", "resourcePersonId"),
    CONSTRAINT "MissionResourcePerson_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionResourcePerson_resourcePersonId_fkey" FOREIGN KEY ("resourcePersonId") REFERENCES "ResourcePerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "questions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Questionnaire_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionQuestionnaire" (
    "missionId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,

    PRIMARY KEY ("missionId", "questionnaireId"),
    CONSTRAINT "MissionQuestionnaire_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionQuestionnaire_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "unverified" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldNote_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "results" TEXT,
    "difficulties" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MissionReport_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TakedownRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT,
    "mediaId" TEXT,
    "pageUrl" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterContact" TEXT NOT NULL,
    "requesterRelation" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "resolution" TEXT,
    "handledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TakedownRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CulturalItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TakedownRequest_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TakedownRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    PRIMARY KEY ("role", "permission")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "location" TEXT,
    "summary" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "triggeredById" TEXT,
    CONSTRAINT "BackupRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Place_type_idx" ON "Place"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Place_parentId_name_key" ON "Place"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityName_communityId_name_key" ON "CommunityName"("communityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalItem_slug_key" ON "CulturalItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalItem_publishedVersionId_key" ON "CulturalItem"("publishedVersionId");

-- CreateIndex
CREATE INDEX "CulturalItem_status_idx" ON "CulturalItem"("status");

-- CreateIndex
CREATE INDEX "CulturalItem_categoryId_idx" ON "CulturalItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVersion_itemId_version_key" ON "ItemVersion"("itemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ItemRelation_fromId_toId_type_key" ON "ItemRelation"("fromId", "toId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_itemId_userId_key" ON "AccessGrant"("itemId", "userId");

-- CreateIndex
CREATE INDEX "ValidationDecision_itemId_idx" ON "ValidationDecision"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_originalFileId_key" ON "MediaAsset"("originalFileId");

-- CreateIndex
CREATE INDEX "MediaAsset_kind_idx" ON "MediaAsset"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "TextRevision_textId_version_key" ON "TextRevision"("textId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_code_key" ON "Mission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Questionnaire_slug_key" ON "Questionnaire"("slug");

-- CreateIndex
CREATE INDEX "TakedownRequest_status_idx" ON "TakedownRequest"("status");
