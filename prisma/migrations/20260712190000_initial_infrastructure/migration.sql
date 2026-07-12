-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReportGenerationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "ArtifactIntegrityStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "encounterData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedAttempt" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "generationStatus" "ReportGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "generationError" TEXT,
    "integrityStatus" "ArtifactIntegrityStatus" NOT NULL DEFAULT 'PENDING',
    "percentage" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompletedAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyEvaluation" (
    "id" TEXT NOT NULL,
    "completedAttemptId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacultyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyScore" (
    "id" TEXT NOT NULL,
    "completedAttemptId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacultyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyReport" (
    "id" TEXT NOT NULL,
    "completedAttemptId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacultyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE INDEX "Encounter_userId_caseId_createdAt_idx" ON "Encounter"("userId", "caseId", "createdAt");
CREATE UNIQUE INDEX "CompletedAttempt_userId_attemptId_key" ON "CompletedAttempt"("userId", "attemptId");
CREATE INDEX "CompletedAttempt_userId_caseId_createdAt_idx" ON "CompletedAttempt"("userId", "caseId", "createdAt");
CREATE INDEX "CompletedAttempt_generationStatus_idx" ON "CompletedAttempt"("generationStatus");
CREATE INDEX "CompletedAttempt_encounterId_idx" ON "CompletedAttempt"("encounterId");
CREATE UNIQUE INDEX "FacultyEvaluation_completedAttemptId_key" ON "FacultyEvaluation"("completedAttemptId");
CREATE UNIQUE INDEX "FacultyScore_completedAttemptId_key" ON "FacultyScore"("completedAttemptId");
CREATE UNIQUE INDEX "FacultyReport_completedAttemptId_key" ON "FacultyReport"("completedAttemptId");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompletedAttempt" ADD CONSTRAINT "CompletedAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompletedAttempt" ADD CONSTRAINT "CompletedAttempt_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyEvaluation" ADD CONSTRAINT "FacultyEvaluation_completedAttemptId_fkey" FOREIGN KEY ("completedAttemptId") REFERENCES "CompletedAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyScore" ADD CONSTRAINT "FacultyScore_completedAttemptId_fkey" FOREIGN KEY ("completedAttemptId") REFERENCES "CompletedAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyReport" ADD CONSTRAINT "FacultyReport_completedAttemptId_fkey" FOREIGN KEY ("completedAttemptId") REFERENCES "CompletedAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
