from pathlib import Path
p=Path('src/lib/patientOutputGuard.ts');s=p.read_text(encoding='utf8');line=next(x for x in s.splitlines() if 'return "contradiction of Case 5 lingering cold pain";' in x);s=s.replace(line,'''  const coldClaims = response.replace(/[’‘]/g, "'").split(/[.!?;]+/);
  const deniedColdPain = coldClaims.some(clause => /\\bcold\\b.{0,25}\\b(?:doesn't|does not|no longer) (?:hurt|worsen|cause pain|make (?:it|the pain) worse)\\b|\\bcold\\b.{0,25}\\b(?:isn't|is not) painful\\b/i.test(clause));
  const immediateResolution = coldClaims.some(clause => {
    const resolution = /\\b(?:pain|it)\\b.{0,15}\\b(?:stops?|goes away)\\b.{0,20}\\b(?:immediately|right away)\\b/i.exec(clause);
    return resolution && !/\\b(?:not|never|doesn't|does not|won't|will not)\\b/i.test(resolution[0]);
  });
  if (deniedColdPain || immediateResolution) return "contradiction of Case 5 lingering cold pain";''');p.write_text(s,encoding='utf8')
p=Path('src/app/api/conversation/route.ts');s=p.read_text(encoding='utf8');marker='    const patientQuestionMayBeAdded =';s=s.replace(marker,'''    // A plan-only turn needs an acknowledgment, not invented practical barriers.
    // Preserve governed consent/clinical answers. Semantic plan evidence is required;
    // wording/topic matching alone never grants question eligibility.
    const verifiedPlan = classificationResult?.success && [
      "hospitalAdmissionOrSurgicalManagementDiscussed", "antibioticsRecommendedAsCurrentPlan",
      "temporaryTreatmentActive", "painManagementOrDispositionDiscussed",
    ].some(event => classificationResult.classification.detectedEvents[event as keyof typeof classificationResult.classification.detectedEvents]);
    if (verifiedPlan && !immediateResponse && turnRequiredFacts.length === 0
      && ["disposition_plan", "medication_plan", "treatment_plan"].includes(disclosureState.providerMessageIntent)) {
      finalResponseText = "Okay, thank you.";
    }
    const patientQuestionMayBeAdded =''');p.write_text(s,encoding='utf8')
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8');marker="fs.writeFileSync('validation/v7/focused-regressions.json'";s=s.replace(marker,'''for(const good of ["Cold drinks make the pain worse. The pain does not stop immediately after the cold is removed; it keeps hurting for a little while afterward.","The pain doesn't stop right away after cold; it lingers."])assert(validatePatientFinalResponse(good,{canonicalFacts:facts('case-05')}).valid,good);
for(const bad of ["Cold doesn't hurt.","The pain stops immediately after cold is removed.","It goes away right away after cold."])assert(!validatePatientFinalResponse(bad,{canonicalFacts:facts('case-05')}).valid,bad);
''' +marker);p.write_text(s,encoding='utf8')
