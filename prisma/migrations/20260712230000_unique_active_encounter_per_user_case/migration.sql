CREATE UNIQUE INDEX "Encounter_one_active_per_user_case_key"
ON "Encounter"("userId", "caseId")
WHERE "status" = 'ACTIVE';
