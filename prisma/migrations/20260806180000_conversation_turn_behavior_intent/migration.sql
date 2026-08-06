ALTER TABLE "ConversationTurn"
ADD COLUMN "behaviorIntentId" TEXT,
ADD COLUMN "behaviorAnswerClear" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ConversationTurn_encounterId_behaviorIntentId_createdAt_idx"
ON "ConversationTurn"("encounterId", "behaviorIntentId", "createdAt");
