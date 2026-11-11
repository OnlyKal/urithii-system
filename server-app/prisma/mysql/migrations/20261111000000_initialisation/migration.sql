-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `displayName` LONGTEXT NOT NULL,
    `passwordHash` LONGTEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'RESPONSABLE_COLLECTE', 'COLLECTEUR', 'TRANSCRIPTEUR', 'TRADUCTEUR', 'VALIDATEUR', 'EDITEUR') NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserRole_userId_role_key`(`userId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `ip` LONGTEXT NULL,
    `userAgent` LONGTEXT NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `details` LONGTEXT NULL,
    `ip` LONGTEXT NULL,
    `prevHash` LONGTEXT NOT NULL,
    `hash` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AuditLog_hash_key`(`hash`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoredFile` (
    `id` VARCHAR(191) NOT NULL,
    `originalName` LONGTEXT NOT NULL,
    `mimeType` LONGTEXT NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `derivedFromId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastCheckedAt` DATETIME(3) NULL,
    `integrityStatus` VARCHAR(191) NOT NULL DEFAULT 'UNCHECKED',
    `transformation` LONGTEXT NULL,

    UNIQUE INDEX `StoredFile_storageKey_key`(`storageKey`),
    INDEX `StoredFile_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Place` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('COUNTRY', 'PROVINCE', 'TERRITORY', 'CITY', 'COMMUNE', 'CHIEFDOM', 'LOCALITY', 'VILLAGE', 'OTHER') NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Place_type_idx`(`type`),
    UNIQUE INDEX `Place_parentId_name_key`(`parentId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Language` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isoCode` LONGTEXT NULL,
    `parentId` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Language_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` LONGTEXT NOT NULL,
    `description` LONGTEXT NULL,
    `code` LONGTEXT NULL,
    `parentId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `fieldsSchema` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Community` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` LONGTEXT NOT NULL,
    `summary` LONGTEXT NULL,
    `description` LONGTEXT NULL,
    `history` LONGTEXT NULL,
    `documentationStatus` ENUM('NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'ADVANCED') NOT NULL DEFAULT 'NOT_STARTED',
    `documentationNote` LONGTEXT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `searchText` LONGTEXT NOT NULL DEFAULT (''),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Community_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityName` (
    `id` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('PRIMARY', 'AUTONYM', 'EXONYM', 'HISTORICAL', 'VARIANT') NOT NULL DEFAULT 'VARIANT',
    `notes` LONGTEXT NULL,
    `sourceId` VARCHAR(191) NULL,

    UNIQUE INDEX `CommunityName_communityId_name_key`(`communityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityPlace` (
    `communityId` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `notes` LONGTEXT NULL,
    `sourceId` VARCHAR(191) NULL,

    PRIMARY KEY (`communityId`, `placeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityLanguage` (
    `communityId` VARCHAR(191) NOT NULL,
    `languageId` VARCHAR(191) NOT NULL,
    `notes` LONGTEXT NULL,

    PRIMARY KEY (`communityId`, `languageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Source` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOK', 'ARTICLE', 'THESIS', 'ARCHIVE', 'REPORT', 'PHOTOGRAPH', 'TESTIMONY', 'RECORDING', 'ADMINISTRATIVE', 'WEBSITE', 'COLLECTION', 'FIELDWORK', 'OTHER') NOT NULL,
    `title` LONGTEXT NOT NULL,
    `author` LONGTEXT NULL,
    `date` LONGTEXT NULL,
    `publisher` LONGTEXT NULL,
    `provenance` LONGTEXT NULL,
    `reference` LONGTEXT NULL,
    `url` LONGTEXT NULL,
    `rights` LONGTEXT NULL,
    `status` ENUM('ACTIVE', 'CONTESTED', 'UNAVAILABLE', 'REPLACED') NOT NULL DEFAULT 'ACTIVE',
    `statusNote` LONGTEXT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourcePerson` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` LONGTEXT NOT NULL,
    `publicName` LONGTEXT NULL,
    `attributionMode` ENUM('NAME', 'PSEUDONYM', 'ANONYMOUS') NOT NULL DEFAULT 'ANONYMOUS',
    `communityId` VARCHAR(191) NULL,
    `locality` LONGTEXT NULL,
    `contact` LONGTEXT NULL,
    `birthYear` INTEGER NULL,
    `isMinor` BOOLEAN NOT NULL DEFAULT false,
    `guardianName` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consent` (
    `id` VARCHAR(191) NOT NULL,
    `resourcePersonId` VARCHAR(191) NULL,
    `missionId` VARCHAR(191) NULL,
    `collectedById` VARCHAR(191) NOT NULL,
    `collectedAt` DATETIME(3) NOT NULL,
    `canStore` BOOLEAN NOT NULL DEFAULT true,
    `canProcess` BOOLEAN NOT NULL DEFAULT false,
    `canPublish` BOOLEAN NOT NULL DEFAULT false,
    `canTranslate` BOOLEAN NOT NULL DEFAULT false,
    `canReuse` BOOLEAN NOT NULL DEFAULT false,
    `allowsInterview` BOOLEAN NOT NULL DEFAULT true,
    `allowsAudio` BOOLEAN NOT NULL DEFAULT false,
    `allowsVideo` BOOLEAN NOT NULL DEFAULT false,
    `allowsPhoto` BOOLEAN NOT NULL DEFAULT false,
    `allowsTranscription` BOOLEAN NOT NULL DEFAULT false,
    `attribution` ENUM('NAME', 'PSEUDONYM', 'ANONYMOUS') NOT NULL DEFAULT 'ANONYMOUS',
    `restrictions` LONGTEXT NULL,
    `guardianConsent` BOOLEAN NOT NULL DEFAULT false,
    `communityAuthorization` LONGTEXT NULL,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` LONGTEXT NULL,
    `documentFileId` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CulturalItem` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NOT NULL,
    `originalTitle` LONGTEXT NULL,
    `summary` LONGTEXT NULL,
    `body` LONGTEXT NULL,
    `fields` LONGTEXT NULL,
    `keywords` LONGTEXT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `originalLanguageId` VARCHAR(191) NULL,
    `dateKind` ENUM('EXACT', 'APPROXIMATE', 'PERIOD', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `dateValue` LONGTEXT NULL,
    `dateEnd` LONGTEXT NULL,
    `verificationStatus` ENUM('SOURCED', 'TESTIMONY', 'ORAL_TRADITION', 'CORROBORATED', 'CONTESTED', 'HYPOTHESIS', 'INCOMPLETE') NOT NULL DEFAULT 'INCOMPLETE',
    `status` ENUM('DRAFT', 'IN_PREPARATION', 'SUBMITTED', 'NEEDS_COMPLETION', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'AWAITING_AUTHORIZATION', 'VALIDATED', 'SCHEDULED', 'PUBLISHED', 'UNDER_REVISION', 'SUSPENDED', 'WITHDRAWN', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `accessLevel` ENUM('PUBLIC', 'CONTRIBUTORS', 'TEAM', 'SPECIAL', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE',
    `isSensitive` BOOLEAN NOT NULL DEFAULT false,
    `resourcePersonId` VARCHAR(191) NULL,
    `missionId` VARCHAR(191) NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 1,
    `publishedVersionId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `searchText` LONGTEXT NOT NULL DEFAULT (''),
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `dossierId` VARCHAR(191) NULL,
    `dossierUnit` LONGTEXT NULL,

    UNIQUE INDEX `CulturalItem_slug_key`(`slug`),
    UNIQUE INDEX `CulturalItem_publishedVersionId_key`(`publishedVersionId`),
    INDEX `CulturalItem_status_idx`(`status`),
    INDEX `CulturalItem_categoryId_idx`(`categoryId`),
    INDEX `CulturalItem_dossierId_idx`(`dossierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemVersion` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `reason` LONGTEXT NOT NULL,
    `publicNote` LONGTEXT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ItemVersion_itemId_version_key`(`itemId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemCommunity` (
    `itemId` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`itemId`, `communityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemPlace` (
    `itemId` VARCHAR(191) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`itemId`, `placeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemSource` (
    `itemId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `supports` LONGTEXT NULL,
    `locator` LONGTEXT NULL,

    PRIMARY KEY (`itemId`, `sourceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemMedia` (
    `itemId` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `caption` LONGTEXT NULL,

    PRIMARY KEY (`itemId`, `mediaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemConsent` (
    `itemId` VARCHAR(191) NOT NULL,
    `consentId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`itemId`, `consentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemRelation` (
    `id` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,
    `type` ENUM('RELATED', 'VARIANT_OF', 'PART_OF', 'INGREDIENT', 'INSTRUMENT', 'COSTUME', 'SONG', 'CONTEXT', 'TESTIMONY_FOR') NOT NULL DEFAULT 'RELATED',
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ItemRelation_fromId_toId_type_key`(`fromId`, `toId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGrant` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `grantedById` VARCHAR(191) NOT NULL,
    `reason` LONGTEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AccessGrant_itemId_userId_key`(`itemId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValidationDecision` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `type` ENUM('TRANSITION', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'COMMENT') NOT NULL,
    `fromStatus` ENUM('DRAFT', 'IN_PREPARATION', 'SUBMITTED', 'NEEDS_COMPLETION', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'AWAITING_AUTHORIZATION', 'VALIDATED', 'SCHEDULED', 'PUBLISHED', 'UNDER_REVISION', 'SUSPENDED', 'WITHDRAWN', 'ARCHIVED') NULL,
    `toStatus` ENUM('DRAFT', 'IN_PREPARATION', 'SUBMITTED', 'NEEDS_COMPLETION', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'AWAITING_AUTHORIZATION', 'VALIDATED', 'SCHEDULED', 'PUBLISHED', 'UNDER_REVISION', 'SUSPENDED', 'WITHDRAWN', 'ARCHIVED') NULL,
    `reason` LONGTEXT NULL,
    `comments` LONGTEXT NULL,
    `requestedChanges` LONGTEXT NULL,
    `version` INTEGER NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ValidationDecision_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NULL,
    `originalFileId` VARCHAR(191) NOT NULL,
    `webFileId` VARCHAR(191) NULL,
    `thumbnailFileId` VARCHAR(191) NULL,
    `accessLevel` ENUM('PUBLIC', 'CONTRIBUTORS', 'TEAM', 'SPECIAL', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE',
    `consentId` VARCHAR(191) NULL,
    `publicationCleared` BOOLEAN NOT NULL DEFAULT false,
    `rightsStatement` LONGTEXT NULL,
    `credit` LONGTEXT NULL,
    `dateKind` ENUM('EXACT', 'APPROXIMATE', 'PERIOD', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `dateValue` LONGTEXT NULL,
    `placeId` VARCHAR(191) NULL,
    `peopleDepicted` LONGTEXT NULL,
    `context` LONGTEXT NULL,
    `provenance` LONGTEXT NULL,
    `missionId` VARCHAR(191) NULL,
    `collectedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaAsset_originalFileId_key`(`originalFileId`),
    INDEX `MediaAsset_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TextDocument` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('TRANSCRIPTION', 'TRANSLATION') NOT NULL,
    `mediaId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `translationOfId` VARCHAR(191) NULL,
    `languageId` VARCHAR(191) NOT NULL,
    `method` ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL',
    `verification` ENUM('UNVERIFIED', 'VERIFIED') NOT NULL DEFAULT 'UNVERIFIED',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `translatorRole` LONGTEXT NULL,
    `notes` LONGTEXT NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 1,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TextRevision` (
    `id` VARCHAR(191) NOT NULL,
    `textId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `reason` LONGTEXT NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TextRevision_textId_version_key`(`textId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NOT NULL,
    `objective` LONGTEXT NOT NULL,
    `communityId` VARCHAR(191) NULL,
    `placeId` VARCHAR(191) NULL,
    `categoryIds` LONGTEXT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `responsibleId` VARCHAR(191) NOT NULL,
    `status` ENUM('PLANNED', 'PREPARATION', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `requiredDocuments` LONGTEXT NULL,
    `safetyGuidelines` LONGTEXT NULL,
    `expectedResults` LONGTEXT NULL,
    `budget` LONGTEXT NULL,
    `difficulties` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Mission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MissionMember` (
    `missionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'COLLECTEUR',
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`missionId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MissionResourcePerson` (
    `missionId` VARCHAR(191) NOT NULL,
    `resourcePersonId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`missionId`, `resourcePersonId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Questionnaire` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NULL,
    `categoryId` VARCHAR(191) NULL,
    `questions` LONGTEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Questionnaire_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MissionQuestionnaire` (
    `missionId` VARCHAR(191) NOT NULL,
    `questionnaireId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`missionId`, `questionnaireId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FieldNote` (
    `id` VARCHAR(191) NOT NULL,
    `missionId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `unverified` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MissionReport` (
    `id` VARCHAR(191) NOT NULL,
    `missionId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `results` LONGTEXT NULL,
    `difficulties` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'REVIEWED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TakedownRequest` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NULL,
    `mediaId` VARCHAR(191) NULL,
    `pageUrl` LONGTEXT NULL,
    `requesterName` LONGTEXT NOT NULL,
    `requesterContact` LONGTEXT NOT NULL,
    `requesterRelation` LONGTEXT NULL,
    `reason` ENUM('ERROR', 'MISATTRIBUTION', 'CONSENT', 'PRIVACY', 'CULTURAL_RESTRICTION', 'UNAUTHORIZED_USE', 'MISLEADING', 'OTHER') NOT NULL,
    `description` LONGTEXT NOT NULL,
    `status` ENUM('RECEIVED', 'UNDER_REVIEW', 'CONTENT_SUSPENDED', 'RESOLVED_CORRECTED', 'RESOLVED_WITHDRAWN', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `resolution` LONGTEXT NULL,
    `handledById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TakedownRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `role` ENUM('SUPER_ADMIN', 'RESPONSABLE_COLLECTE', 'COLLECTEUR', 'TRANSCRIPTEUR', 'TRADUCTEUR', 'VALIDATEUR', 'EDITEUR') NOT NULL,
    `permission` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`role`, `permission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupRun` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('BACKUP', 'RESTORE_TEST', 'INTEGRITY_CHECK') NOT NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `location` LONGTEXT NULL,
    `summary` LONGTEXT NULL,
    `error` LONGTEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `triggeredById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DossierSectionDef` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `position` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `categoryId` VARCHAR(191) NULL,
    `fields` LONGTEXT NOT NULL DEFAULT ('[]'),
    `entry` LONGTEXT NULL,
    `mediaHint` LONGTEXT NULL,
    `sensitiveNotice` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DossierSectionDef_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionDossier` (
    `id` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NULL,
    `communityId` VARCHAR(191) NULL,
    `proposedCommunityName` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VALIDATED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `data` LONGTEXT NOT NULL DEFAULT ('{}'),
    `reviews` LONGTEXT NOT NULL DEFAULT ('{}'),
    `publication` LONGTEXT NOT NULL DEFAULT ('{}'),
    `progress` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `collectorId` VARCHAR(191) NOT NULL,
    `missionId` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `validatedAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CollectionDossier_status_idx`(`status`),
    INDEX `CollectionDossier_collectorId_idx`(`collectorId`),
    INDEX `CollectionDossier_communityId_idx`(`communityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DossierEvent` (
    `id` VARCHAR(191) NOT NULL,
    `dossierId` VARCHAR(191) NOT NULL,
    `type` LONGTEXT NOT NULL,
    `sectionKey` LONGTEXT NULL,
    `fromStatus` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VALIDATED', 'PUBLISHED', 'ARCHIVED') NULL,
    `toStatus` ENUM('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VALIDATED', 'PUBLISHED', 'ARCHIVED') NULL,
    `comment` LONGTEXT NULL,
    `version` INTEGER NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DossierEvent_dossierId_idx`(`dossierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DossierVersion` (
    `id` VARCHAR(191) NOT NULL,
    `dossierId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `data` LONGTEXT NOT NULL,
    `reason` LONGTEXT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DossierVersion_dossierId_version_key`(`dossierId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameMission` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` LONGTEXT NOT NULL,
    `description` LONGTEXT NOT NULL,
    `objective` LONGTEXT NOT NULL,
    `mode` LONGTEXT NOT NULL,
    `environment` LONGTEXT NOT NULL,
    `steps` LONGTEXT NOT NULL,
    `rewardXp` INTEGER NOT NULL DEFAULT 100,
    `badge` LONGTEXT NULL,
    `communityId` VARCHAR(191) NULL,
    `contentRefs` LONGTEXT NOT NULL DEFAULT ('[]'),
    `status` ENUM('DRAFT', 'PUBLISHED', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
    `position` INTEGER NOT NULL DEFAULT 0,
    `builtin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GameMission_slug_key`(`slug`),
    INDEX `GameMission_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameStat` (
    `id` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `mission` VARCHAR(191) NOT NULL DEFAULT '',
    `count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `GameStat_day_event_mission_key`(`day`, `event`, `mission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredFile` ADD CONSTRAINT `StoredFile_derivedFromId_fkey` FOREIGN KEY (`derivedFromId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredFile` ADD CONSTRAINT `StoredFile_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Place` ADD CONSTRAINT `Place_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Place`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Language` ADD CONSTRAINT `Language_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityName` ADD CONSTRAINT `CommunityName_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityName` ADD CONSTRAINT `CommunityName_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `Source`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityPlace` ADD CONSTRAINT `CommunityPlace_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityPlace` ADD CONSTRAINT `CommunityPlace_placeId_fkey` FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityPlace` ADD CONSTRAINT `CommunityPlace_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `Source`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityLanguage` ADD CONSTRAINT `CommunityLanguage_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityLanguage` ADD CONSTRAINT `CommunityLanguage_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourcePerson` ADD CONSTRAINT `ResourcePerson_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourcePerson` ADD CONSTRAINT `ResourcePerson_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_resourcePersonId_fkey` FOREIGN KEY (`resourcePersonId`) REFERENCES `ResourcePerson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_collectedById_fkey` FOREIGN KEY (`collectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_documentFileId_fkey` FOREIGN KEY (`documentFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_originalLanguageId_fkey` FOREIGN KEY (`originalLanguageId`) REFERENCES `Language`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_resourcePersonId_fkey` FOREIGN KEY (`resourcePersonId`) REFERENCES `ResourcePerson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `ItemVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CulturalItem` ADD CONSTRAINT `CulturalItem_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemVersion` ADD CONSTRAINT `ItemVersion_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemVersion` ADD CONSTRAINT `ItemVersion_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCommunity` ADD CONSTRAINT `ItemCommunity_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCommunity` ADD CONSTRAINT `ItemCommunity_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPlace` ADD CONSTRAINT `ItemPlace_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPlace` ADD CONSTRAINT `ItemPlace_placeId_fkey` FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemSource` ADD CONSTRAINT `ItemSource_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemSource` ADD CONSTRAINT `ItemSource_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `Source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemMedia` ADD CONSTRAINT `ItemMedia_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemMedia` ADD CONSTRAINT `ItemMedia_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemConsent` ADD CONSTRAINT `ItemConsent_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemConsent` ADD CONSTRAINT `ItemConsent_consentId_fkey` FOREIGN KEY (`consentId`) REFERENCES `Consent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemRelation` ADD CONSTRAINT `ItemRelation_fromId_fkey` FOREIGN KEY (`fromId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemRelation` ADD CONSTRAINT `ItemRelation_toId_fkey` FOREIGN KEY (`toId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidationDecision` ADD CONSTRAINT `ValidationDecision_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidationDecision` ADD CONSTRAINT `ValidationDecision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_originalFileId_fkey` FOREIGN KEY (`originalFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_webFileId_fkey` FOREIGN KEY (`webFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_thumbnailFileId_fkey` FOREIGN KEY (`thumbnailFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_consentId_fkey` FOREIGN KEY (`consentId`) REFERENCES `Consent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_placeId_fkey` FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextDocument` ADD CONSTRAINT `TextDocument_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextDocument` ADD CONSTRAINT `TextDocument_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextDocument` ADD CONSTRAINT `TextDocument_translationOfId_fkey` FOREIGN KEY (`translationOfId`) REFERENCES `TextDocument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextDocument` ADD CONSTRAINT `TextDocument_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextDocument` ADD CONSTRAINT `TextDocument_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextRevision` ADD CONSTRAINT `TextRevision_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `TextDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TextRevision` ADD CONSTRAINT `TextRevision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mission` ADD CONSTRAINT `Mission_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mission` ADD CONSTRAINT `Mission_placeId_fkey` FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mission` ADD CONSTRAINT `Mission_responsibleId_fkey` FOREIGN KEY (`responsibleId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionMember` ADD CONSTRAINT `MissionMember_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionMember` ADD CONSTRAINT `MissionMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionResourcePerson` ADD CONSTRAINT `MissionResourcePerson_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionResourcePerson` ADD CONSTRAINT `MissionResourcePerson_resourcePersonId_fkey` FOREIGN KEY (`resourcePersonId`) REFERENCES `ResourcePerson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Questionnaire` ADD CONSTRAINT `Questionnaire_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionQuestionnaire` ADD CONSTRAINT `MissionQuestionnaire_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionQuestionnaire` ADD CONSTRAINT `MissionQuestionnaire_questionnaireId_fkey` FOREIGN KEY (`questionnaireId`) REFERENCES `Questionnaire`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldNote` ADD CONSTRAINT `FieldNote_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FieldNote` ADD CONSTRAINT `FieldNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionReport` ADD CONSTRAINT `MissionReport_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MissionReport` ADD CONSTRAINT `MissionReport_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TakedownRequest` ADD CONSTRAINT `TakedownRequest_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `CulturalItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TakedownRequest` ADD CONSTRAINT `TakedownRequest_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TakedownRequest` ADD CONSTRAINT `TakedownRequest_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BackupRun` ADD CONSTRAINT `BackupRun_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierSectionDef` ADD CONSTRAINT `DossierSectionDef_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionDossier` ADD CONSTRAINT `CollectionDossier_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionDossier` ADD CONSTRAINT `CollectionDossier_collectorId_fkey` FOREIGN KEY (`collectorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionDossier` ADD CONSTRAINT `CollectionDossier_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierEvent` ADD CONSTRAINT `DossierEvent_dossierId_fkey` FOREIGN KEY (`dossierId`) REFERENCES `CollectionDossier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierEvent` ADD CONSTRAINT `DossierEvent_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierVersion` ADD CONSTRAINT `DossierVersion_dossierId_fkey` FOREIGN KEY (`dossierId`) REFERENCES `CollectionDossier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierVersion` ADD CONSTRAINT `DossierVersion_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameMission` ADD CONSTRAINT `GameMission_communityId_fkey` FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

