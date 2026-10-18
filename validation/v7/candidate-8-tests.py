from pathlib import Path
p=Path('scripts/validateV7PatientRepair.ts');s=p.read_text(encoding='utf8').replace("import { expressesRequiredFact }", "import { patientFactFallback } from '../src/lib/patientFactFallback';\nimport { assessCanonicalAssertions } from '../src/lib/patientCanonicalAssertions';\nimport { expressesRequiredFact }");marker="const coldFact=";s=s.replace(marker,'''for(const text of ['My daughter needs a filling.','She has a toothache.','She needs treatment.',"I'm not sure, but my daughter has cavities.","I'd prefer the same clinic because my daughter has cavities."])assert(!assessCanonicalAssertions(text,facts('case-03')).valid,text);
for(const text of ["I'm not sure whether my daughter has cavities.","I'd prefer the same clinic because my daughter has Medicaid.","Her teeth are important to me.","We both need good care."])assert(assessCanonicalAssertions(text,facts('case-03')).valid,text);
assert(!assessCanonicalAssertions('It just comes and goes on its own.',facts('case-05')).valid,'Spontaneous does not establish intermittent pain');
assert(assessCanonicalAssertions("It doesn't come and go; it's constant.",facts('case-05')).valid);
for(const question of ['Does it hurt when you bite or tap the tooth?','What makes the pain worse?','Does the pain happen on its own without touching the tooth?']){
 const c=loadCase('case-05')!,state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:question});
 const required=requiredFactsForTurn(state,question,facts('case-05'));const fallback=patientFactFallback(state,question,facts('case-05'));
 assert(fallback,question);const context={canonicalFacts:facts('case-05'),visibleFacts:state.allowedThisTurn,requiredFacts:required,latestStudentMessage:question};
 assert(validatePatientFinalResponse(fallback,context).valid,`${question} fallback: ${fallback}`);
 const response=await generatePatientRoleSafeResponse({initialOutput:'It comes and goes.',retry:async()=> 'It comes and goes.',fallbackText:fallback,visibleFacts:state.allowedThisTurn,requiredFacts:required,validateAdditional:t=>validatePatientFinalResponse(t,context),allowPatientInitiatedQuestion:false});
 assert.equal(response.text,fallback);assert(validatePatientFinalResponse(response.text,context).valid);
}
for(const id of ['case-03','case-04']){
 const q='Does your daughter have a toothache?',c=loadCase(id)!,state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:q});
 assert.equal(state.backgroundTurn?.clinicalRequested,false,'Child-only clinical question is not an adult clinical question');
 const reply=patientImmediateResponse({caseId:id,message:q,disclosureState:state});assert(reply);assert(validatePatientFinalResponse(reply,{canonicalFacts:facts(id),backgroundTurn:state.backgroundTurn,latestStudentMessage:q}).valid,`${id} ${reply}`);
 if(id==='case-04')assert(!reply.includes('my daughter'));
}
const coldFact=''' );p.write_text(s,encoding='utf8')
