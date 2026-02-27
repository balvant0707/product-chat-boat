-- AlterTable
ALTER TABLE `shop` ADD COLUMN `defaultLocale` VARCHAR(16) NOT NULL DEFAULT 'en',
    ADD COLUMN `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE `OnboardingProgress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `stepOneInstalled` BOOLEAN NOT NULL DEFAULT true,
    `stepTwoEmbedEnabled` BOOLEAN NOT NULL DEFAULT false,
    `stepThreeBrandingDone` BOOLEAN NOT NULL DEFAULT false,
    `stepFourKnowledgeReady` BOOLEAN NOT NULL DEFAULT false,
    `stepFiveTested` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OnboardingProgress_shopId_key`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BotSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `botName` VARCHAR(80) NOT NULL DEFAULT 'Shop Assistant',
    `subtitle` VARCHAR(160) NULL,
    `avatarUrl` TEXT NULL,
    `logoUrl` TEXT NULL,
    `welcomeMessage` TEXT NOT NULL DEFAULT 'Hi! I am here to help. What can I do for you?',
    `offlineMessage` TEXT NOT NULL DEFAULT 'Thanks for reaching out. Our team will get back shortly.',
    `greetingRules` JSON NULL,
    `timeBasedGreetingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `primaryColor` VARCHAR(16) NOT NULL DEFAULT '#008060',
    `gradientFrom` VARCHAR(16) NULL,
    `gradientTo` VARCHAR(16) NULL,
    `buttonColor` VARCHAR(16) NULL,
    `hoverColor` VARCHAR(16) NULL,
    `fontFamily` VARCHAR(120) NULL,
    `fontScale` DOUBLE NOT NULL DEFAULT 1,
    `widgetPosition` ENUM('BOTTOM_LEFT', 'BOTTOM_RIGHT') NOT NULL DEFAULT 'BOTTOM_RIGHT',
    `launcherStyle` ENUM('BUBBLE', 'ICON', 'FULL_BUTTON') NOT NULL DEFAULT 'BUBBLE',
    `cornerRadius` INTEGER NOT NULL DEFAULT 20,
    `shadowLevel` INTEGER NOT NULL DEFAULT 3,
    `spacingScale` DOUBLE NOT NULL DEFAULT 1,
    `themeMode` ENUM('LIGHT', 'DARK', 'AUTO') NOT NULL DEFAULT 'AUTO',
    `headerTitle` VARCHAR(120) NULL,
    `headerLogoUrl` TEXT NULL,
    `showHeaderCloseIcon` BOOLEAN NOT NULL DEFAULT true,
    `showPoweredBy` BOOLEAN NOT NULL DEFAULT true,
    `embedEnabled` BOOLEAN NOT NULL DEFAULT false,
    `autoInjectEnabled` BOOLEAN NOT NULL DEFAULT true,
    `manualSnippetEnabled` BOOLEAN NOT NULL DEFAULT true,
    `testModeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `multiStoreEnabled` BOOLEAN NOT NULL DEFAULT false,
    `rememberChatHistory` BOOLEAN NOT NULL DEFAULT true,
    `minimizedBubbleAfterClose` BOOLEAN NOT NULL DEFAULT true,
    `showTypingIndicator` BOOLEAN NOT NULL DEFAULT true,
    `showMessageTimestamps` BOOLEAN NOT NULL DEFAULT true,
    `supportRichMessages` BOOLEAN NOT NULL DEFAULT true,
    `maxProducts` INTEGER NOT NULL DEFAULT 5,
    `showPrivacyMessage` BOOLEAN NOT NULL DEFAULT false,
    `privacyMessage` TEXT NULL,
    `consentCheckboxRequired` BOOLEAN NOT NULL DEFAULT false,
    `consentMessage` TEXT NULL,
    `workingHoursEnabled` BOOLEAN NOT NULL DEFAULT false,
    `workingHoursTimezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
    `proactiveWelcomeEnabled` BOOLEAN NOT NULL DEFAULT true,
    `proactiveExitIntentEnabled` BOOLEAN NOT NULL DEFAULT false,
    `proactiveTimeOnPageSec` INTEGER NOT NULL DEFAULT 10,
    `productPagePrompt` TEXT NULL,
    `cartPagePrompt` TEXT NULL,
    `policyPagePrompt` TEXT NULL,
    `cartValueOfferThreshold` DECIMAL(10, 2) NULL,
    `cartValueOfferMessage` TEXT NULL,
    `abandonedCheckoutPromptEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BotSetting_shopId_key`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `hybridModeEnabled` BOOLEAN NOT NULL DEFAULT true,
    `provider` VARCHAR(64) NOT NULL DEFAULT 'claude',
    `model` VARCHAR(120) NULL,
    `encryptedApiKey` TEXT NULL,
    `tone` ENUM('FRIENDLY', 'PROFESSIONAL', 'CONCISE', 'CUSTOM') NOT NULL DEFAULT 'FRIENDLY',
    `answerLength` ENUM('SHORT', 'MEDIUM', 'LONG') NOT NULL DEFAULT 'MEDIUM',
    `systemPrompt` TEXT NULL,
    `safeNoGuessing` BOOLEAN NOT NULL DEFAULT true,
    `safeShowLinks` BOOLEAN NOT NULL DEFAULT true,
    `blacklistTopics` JSON NULL,
    `confidenceThreshold` DOUBLE NOT NULL DEFAULT 0.6,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `fallbackToFlow` BOOLEAN NOT NULL DEFAULT true,
    `fallbackToAgent` BOOLEAN NOT NULL DEFAULT false,
    `knowledgeSyncFrequency` ENUM('MANUAL', 'DAILY', 'WEEKLY') NOT NULL DEFAULT 'DAILY',
    `knowledgeLastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiSetting_shopId_key`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Flow` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `description` TEXT NULL,
    `language` VARCHAR(16) NOT NULL DEFAULT 'en',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isWorkingHoursFlow` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,

    INDEX `Flow_shopId_status_idx`(`shopId`, `status`),
    INDEX `Flow_shopId_language_idx`(`shopId`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlowNode` (
    `id` VARCHAR(191) NOT NULL,
    `flowId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `label` VARCHAR(140) NOT NULL,
    `config` JSON NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FlowNode_flowId_position_idx`(`flowId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlowEdge` (
    `id` VARCHAR(191) NOT NULL,
    `flowId` VARCHAR(191) NOT NULL,
    `fromNodeId` VARCHAR(191) NOT NULL,
    `toNodeId` VARCHAR(191) NOT NULL,
    `conditionType` VARCHAR(64) NULL,
    `conditionValue` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FlowEdge_flowId_idx`(`flowId`),
    INDEX `FlowEdge_fromNodeId_idx`(`fromNodeId`),
    INDEX `FlowEdge_toNodeId_idx`(`toNodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeSource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `type` ENUM('STORE_PAGE', 'PRODUCT_CATALOG', 'COLLECTION', 'TAG', 'CUSTOM_QA', 'FILE_UPLOAD', 'URL_IMPORT') NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `sourceUrl` TEXT NULL,
    `fileKey` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `syncFrequency` ENUM('MANUAL', 'DAILY', 'WEEKLY') NOT NULL DEFAULT 'MANUAL',
    `scheduleCron` VARCHAR(120) NULL,
    `options` JSON NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeSource_shopId_type_idx`(`shopId`, `type`),
    INDEX `KnowledgeSource_shopId_isActive_idx`(`shopId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeItem` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `sourceId` INTEGER NULL,
    `locale` VARCHAR(16) NOT NULL DEFAULT 'en',
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `sourceReference` TEXT NULL,
    `embeddingKey` VARCHAR(191) NULL,
    `confidence` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeItem_shopId_locale_idx`(`shopId`, `locale`),
    INDEX `KnowledgeItem_sourceId_idx`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeSyncJob` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `sourceId` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'queued',
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `resultSummary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeSyncJob_shopId_status_createdAt_idx`(`shopId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `externalSessionId` VARCHAR(191) NULL,
    `visitorId` VARCHAR(191) NULL,
    `customerName` VARCHAR(120) NULL,
    `customerEmail` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(40) NULL,
    `source` ENUM('WIDGET', 'ADMIN', 'API', 'WHATSAPP', 'INSTAGRAM', 'EMAIL') NOT NULL DEFAULT 'WIDGET',
    `locale` VARCHAR(16) NOT NULL DEFAULT 'en',
    `sourcePage` TEXT NULL,
    `status` ENUM('ACTIVE', 'PENDING', 'RESOLVED', 'CLOSED', 'SPAM') NOT NULL DEFAULT 'ACTIVE',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastMessageAt` DATETIME(3) NULL,
    `firstResponseAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `handoffRequested` BOOLEAN NOT NULL DEFAULT false,
    `handoffReason` ENUM('USER_REQUEST', 'SENTIMENT', 'NO_ANSWER', 'WORKING_HOURS', 'RULE', 'UNKNOWN') NULL,
    `sentimentScore` DOUBLE NULL,
    `tags` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_shopId_status_startedAt_idx`(`shopId`, `status`, `startedAt`),
    INDEX `Conversation_shopId_externalSessionId_idx`(`shopId`, `externalSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `role` ENUM('USER', 'BOT', 'AGENT', 'SYSTEM') NOT NULL,
    `type` ENUM('TEXT', 'QUICK_REPLY', 'PRODUCT_CARD', 'COLLECTION_CARD', 'ORDER_STATUS', 'LINK', 'FORM', 'PROMPT', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
    `body` TEXT NOT NULL,
    `maskedBody` TEXT NULL,
    `payload` JSON NULL,
    `aiConfidence` DOUBLE NULL,
    `tokenUsage` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `ConversationMessage_shopId_createdAt_idx`(`shopId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `shopId` INTEGER NOT NULL,
    `type` ENUM('CONVERSATION_CREATED', 'MESSAGE_SENT', 'LEAD_CAPTURED', 'TICKET_CREATED', 'HANDOFF_TRIGGERED', 'WEBHOOK_SENT', 'WEBHOOK_FAILED') NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationEvent_shopId_type_createdAt_idx`(`shopId`, `type`, `createdAt`),
    INDEX `ConversationEvent_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `externalUserId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INVITED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Agent_shopId_status_idx`(`shopId`, `status`),
    UNIQUE INDEX `Agent_shopId_email_key`(`shopId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `agentId` INTEGER NOT NULL,
    `reason` ENUM('USER_REQUEST', 'SENTIMENT', 'NO_ANSWER', 'WORKING_HOURS', 'RULE', 'UNKNOWN') NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassignedAt` DATETIME(3) NULL,

    INDEX `ConversationAssignment_shopId_assignedAt_idx`(`shopId`, `assignedAt`),
    INDEX `ConversationAssignment_conversationId_unassignedAt_idx`(`conversationId`, `unassignedAt`),
    INDEX `ConversationAssignment_agentId_assignedAt_idx`(`agentId`, `assignedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationNote` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `agentId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationNote_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `ConversationNote_shopId_createdAt_idx`(`shopId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CannedReply` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `shortcut` VARCHAR(40) NULL,
    `tags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CannedReply_shopId_createdAt_idx`(`shopId`, `createdAt`),
    UNIQUE INDEX `CannedReply_shopId_shortcut_key`(`shopId`, `shortcut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(40) NULL,
    `tags` JSON NULL,
    `customFields` JSON NULL,
    `sourcePage` TEXT NULL,
    `sourceCampaign` VARCHAR(120) NULL,
    `consentGiven` BOOLEAN NOT NULL DEFAULT false,
    `consentText` TEXT NULL,
    `exportedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_shopId_createdAt_idx`(`shopId`, `createdAt`),
    INDEX `Lead_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `referenceCode` VARCHAR(40) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('OPEN', 'PENDING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `requesterName` VARCHAR(120) NULL,
    `requesterEmail` VARCHAR(191) NULL,
    `attachmentUrls` JSON NULL,
    `assigneeAgentId` INTEGER NULL,
    `slaDueAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ticket_referenceCode_key`(`referenceCode`),
    INDEX `Ticket_shopId_status_createdAt_idx`(`shopId`, `status`, `createdAt`),
    INDEX `Ticket_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `triggerType` ENUM('FIRST_VISIT', 'RETURNING_VISITOR', 'EXIT_INTENT', 'TIME_ON_PAGE', 'PAGE_VIEW', 'CART_VALUE', 'ABANDONED_CHECKOUT') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 10,
    `conditions` JSON NULL,
    `actions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutomationRule_shopId_triggerType_enabled_idx`(`shopId`, `triggerType`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowupAutomation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP', 'NONE') NOT NULL DEFAULT 'EMAIL',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `delayMinutes` INTEGER NOT NULL DEFAULT 0,
    `template` TEXT NOT NULL,
    `couponCode` VARCHAR(80) NULL,
    `webhookUrl` TEXT NULL,
    `conditions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FollowupAutomation_shopId_channel_enabled_idx`(`shopId`, `channel`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationConnection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `type` ENUM('WEBHOOK', 'KLAVIYO', 'MAILCHIMP', 'GOOGLE_SHEETS', 'ZAPIER', 'MAKE', 'CUSTOM_CRM') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `webhookUrl` TEXT NULL,
    `secretEncrypted` TEXT NULL,
    `apiKeyEncrypted` TEXT NULL,
    `config` JSON NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationConnection_shopId_type_enabled_idx`(`shopId`, `type`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookSubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `eventType` ENUM('CONVERSATION_CREATED', 'MESSAGE_SENT', 'LEAD_CAPTURED', 'TICKET_CREATED', 'HANDOFF_TRIGGERED', 'WEBHOOK_SENT', 'WEBHOOK_FAILED') NOT NULL,
    `endpoint` TEXT NOT NULL,
    `secretHash` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastDeliveryAt` DATETIME(3) NULL,
    `lastStatusCode` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebhookSubscription_shopId_eventType_enabled_idx`(`shopId`, `eventType`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiAccessToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiAccessToken_tokenHash_key`(`tokenHash`),
    INDEX `ApiAccessToken_shopId_revokedAt_idx`(`shopId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `metricType` ENUM('CONVERSATIONS', 'AI_MESSAGES', 'AGENT_MESSAGES', 'LEADS') NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `limitCount` INTEGER NOT NULL DEFAULT 0,
    `alert80SentAt` DATETIME(3) NULL,
    `alert100SentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UsageCounter_shopId_periodEnd_idx`(`shopId`, `periodEnd`),
    UNIQUE INDEX `UsageCounter_shopId_metricType_periodStart_key`(`shopId`, `metricType`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `code` ENUM('FREE', 'PRO', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
    `cycle` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `conversationsPerMonth` INTEGER NOT NULL DEFAULT 200,
    `aiMessagesPerMonth` INTEGER NOT NULL DEFAULT 500,
    `agentsLimit` INTEGER NOT NULL DEFAULT 1,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShopPlan_shopId_active_idx`(`shopId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompliancePolicy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `dataRetentionDays` INTEGER NOT NULL DEFAULT 365,
    `autoDeleteEnabled` BOOLEAN NOT NULL DEFAULT false,
    `piiMaskingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `spamRateLimitPerMinute` INTEGER NOT NULL DEFAULT 30,
    `blockAbusiveWords` BOOLEAN NOT NULL DEFAULT false,
    `abusiveWords` JSON NULL,
    `consentRequired` BOOLEAN NOT NULL DEFAULT false,
    `consentMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompliancePolicy_shopId_key`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockListEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `type` ENUM('IP', 'EMAIL_DOMAIN', 'EMAIL', 'USER_AGENT', 'WORD') NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlockListEntry_shopId_expiresAt_idx`(`shopId`, `expiresAt`),
    UNIQUE INDEX `BlockListEntry_shopId_type_value_key`(`shopId`, `type`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `role` ENUM('OWNER', 'STAFF', 'SUPPORT', 'ANALYST') NOT NULL DEFAULT 'STAFF',
    `permissions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdminRole_shopId_role_idx`(`shopId`, `role`),
    UNIQUE INDEX `AdminRole_shopId_userId_key`(`shopId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `type` ENUM('CHAT_STORAGE', 'MARKETING', 'PRIVACY_POLICY', 'GDPR') NOT NULL,
    `granted` BOOLEAN NOT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentRecord_shopId_type_createdAt_idx`(`shopId`, `type`, `createdAt`),
    INDEX `ConsentRecord_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopLocale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shopId` INTEGER NOT NULL,
    `localeCode` VARCHAR(16) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `flowId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShopLocale_shopId_localeCode_key`(`shopId`, `localeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventLog` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` INTEGER NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventLog_shopId_name_createdAt_idx`(`shopId`, `name`, `createdAt`),
    INDEX `EventLog_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OnboardingProgress` ADD CONSTRAINT `OnboardingProgress_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BotSetting` ADD CONSTRAINT `BotSetting_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiSetting` ADD CONSTRAINT `AiSetting_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Flow` ADD CONSTRAINT `Flow_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlowNode` ADD CONSTRAINT `FlowNode_flowId_fkey` FOREIGN KEY (`flowId`) REFERENCES `Flow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlowEdge` ADD CONSTRAINT `FlowEdge_flowId_fkey` FOREIGN KEY (`flowId`) REFERENCES `Flow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlowEdge` ADD CONSTRAINT `FlowEdge_fromNodeId_fkey` FOREIGN KEY (`fromNodeId`) REFERENCES `FlowNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlowEdge` ADD CONSTRAINT `FlowEdge_toNodeId_fkey` FOREIGN KEY (`toNodeId`) REFERENCES `FlowNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeSource` ADD CONSTRAINT `KnowledgeSource_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeItem` ADD CONSTRAINT `KnowledgeItem_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeItem` ADD CONSTRAINT `KnowledgeItem_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeSyncJob` ADD CONSTRAINT `KnowledgeSyncJob_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeSyncJob` ADD CONSTRAINT `KnowledgeSyncJob_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMessage` ADD CONSTRAINT `ConversationMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMessage` ADD CONSTRAINT `ConversationMessage_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationEvent` ADD CONSTRAINT `ConversationEvent_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationEvent` ADD CONSTRAINT `ConversationEvent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agent` ADD CONSTRAINT `Agent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationAssignment` ADD CONSTRAINT `ConversationAssignment_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationAssignment` ADD CONSTRAINT `ConversationAssignment_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationAssignment` ADD CONSTRAINT `ConversationAssignment_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationNote` ADD CONSTRAINT `ConversationNote_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationNote` ADD CONSTRAINT `ConversationNote_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationNote` ADD CONSTRAINT `ConversationNote_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `Agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CannedReply` ADD CONSTRAINT `CannedReply_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assigneeAgentId_fkey` FOREIGN KEY (`assigneeAgentId`) REFERENCES `Agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRule` ADD CONSTRAINT `AutomationRule_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowupAutomation` ADD CONSTRAINT `FollowupAutomation_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationConnection` ADD CONSTRAINT `IntegrationConnection_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookSubscription` ADD CONSTRAINT `WebhookSubscription_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiAccessToken` ADD CONSTRAINT `ApiAccessToken_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageCounter` ADD CONSTRAINT `UsageCounter_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopPlan` ADD CONSTRAINT `ShopPlan_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompliancePolicy` ADD CONSTRAINT `CompliancePolicy_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlockListEntry` ADD CONSTRAINT `BlockListEntry_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRole` ADD CONSTRAINT `AdminRole_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopLocale` ADD CONSTRAINT `ShopLocale_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopLocale` ADD CONSTRAINT `ShopLocale_flowId_fkey` FOREIGN KEY (`flowId`) REFERENCES `Flow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventLog` ADD CONSTRAINT `EventLog_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventLog` ADD CONSTRAINT `EventLog_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

