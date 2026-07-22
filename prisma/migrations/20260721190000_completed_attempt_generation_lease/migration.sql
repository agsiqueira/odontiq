ALTER TABLE "CompletedAttempt"
ADD COLUMN "generationAttemptId" TEXT,
ADD COLUMN "generationStartedAt" TIMESTAMP(3);
