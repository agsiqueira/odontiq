CREATE TABLE "PatientQuestionState" (
    "encounterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientQuestionState_pkey" PRIMARY KEY ("encounterId")
);

CREATE TABLE "PatientQuestionEmission" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientQuestionEmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentMessageId" TEXT NOT NULL,
    "patientMessageId" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "selectedQuestionId" TEXT,
    "stateVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientQuestionEmission_encounterId_questionId_key"
ON "PatientQuestionEmission"("encounterId", "questionId");
CREATE INDEX "PatientQuestionEmission_encounterId_emittedAt_idx"
ON "PatientQuestionEmission"("encounterId", "emittedAt");
CREATE UNIQUE INDEX "ConversationTurn_encounterId_requestId_key"
ON "ConversationTurn"("encounterId", "requestId");
CREATE INDEX "ConversationTurn_encounterId_createdAt_idx"
ON "ConversationTurn"("encounterId", "createdAt");

ALTER TABLE "PatientQuestionState"
ADD CONSTRAINT "PatientQuestionState_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientQuestionEmission"
ADD CONSTRAINT "PatientQuestionEmission_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationTurn"
ADD CONSTRAINT "ConversationTurn_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
