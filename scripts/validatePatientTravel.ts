import assert from 'node:assert/strict';
import { CASE_DATA } from '../src/data/cases';
import { classifyQuestion, buildPatientDisclosureState } from '../src/lib/patientDisclosure';
import { requiredFactsForTurn } from '../src/lib/patientTurnFacts';
import { assessPatientOutputIntegrity } from '../src/lib/patientOutputGuard';
import { transportationFallback, hasTransportationUncertainty } from '../src/lib/patientTransportation';
import { generatePatientRoleSafeResponse } from '../src/lib/patientRoleResponse';
import { assertPatientFinalResponse } from '../src/lib/patientFinalResponse';

async function main() {
 let count=0;
 for (const c of CASE_DATA) {
  const county=c.supportingInfo.patientFacts!.find(f=>f.id.endsWith('.background-residence'))!.text.match(/([A-Z][a-z]+ County)/)![1];
  for (const q of [`Would you travel out of ${county}?`, 'Can you get to a clinic in another county?', 'Would you travel outside your county for cheaper care?', 'can you travel for Affordable Care', 'Can you travel for affordable care?', 'Do you have a reliable way to get to a dental clinic?', 'Would you travel farther if the treatment were free?', 'If the treatment were free, would you travel farther?']) {
   for (const history of [[],[{id:'prior',role:'patient' as const,text:`I live in ${county}.`,timestamp:'2026-10-16T00:00:00Z'}]]) {
    const classification=classifyQuestion(q);
    assert(classification.questionIntents.includes('background_transportation'));
    assert(!classification.questionIntents.includes('background_residence'));
    assert(!classification.questionIntents.includes('radiation'));
    const state=buildPatientDisclosureState({caseData:c,conversation:history,latestStudentMessage:q});
    const required=requiredFactsForTurn(state,q,c.supportingInfo.patientFacts);
    assert(required.some(f=>f.id.includes('.background-transportation')));
    assert(!required.some(f=>f.id.endsWith('.background-residence')));
    const visible=[...c.supportingInfo.patientFacts!,...state.allowedThisTurn];
    const fallback=transportationFallback(state.allowedThisTurn).join(' ');
    assert(fallback);
    assert(assessPatientOutputIntegrity(fallback,visible,[],required).valid,fallback);
    assert(!assessPatientOutputIntegrity(`I live in ${county}.`,visible,[],required).valid);
    const recovered=await generatePatientRoleSafeResponse({initialOutput:`I live in ${county}.`,visibleFacts:visible,requiredFacts:required,allowPatientInitiatedQuestion:false,fallbackText:fallback,retry:async()=>`I live in ${county}.`});
    assert.equal(recovered.text,fallback);
    assertPatientFinalResponse(fallback,{visibleFacts:visible,requiredFacts:required});
    assert(!assessPatientOutputIntegrity(fallback+" I'm keeping it brief.",visible,[],required).valid);
    if(c.metadata.id!=='case-01' && c.metadata.id!=='case-02') assert(!assessPatientOutputIntegrity("I'm not sure, but I have a car and can travel.",visible,[],required).valid);
    if(c.metadata.id==='case-01') assert(!assessPatientOutputIntegrity("My transportation is not reliable, but I can travel.",visible,[],required).valid);
    if(c.metadata.id!=='case-01' && c.metadata.id!=='case-02') assert(!assessPatientOutputIntegrity("I'm not sure about travel. I don't have a car.",visible,[],required).valid);
    if(c.metadata.id==='case-01') assert(!assessPatientOutputIntegrity("If I can find reliable and affordable care, yes, I would travel outside Alachua County.",visible,[],required).valid, 'Reliable care is not a statement about reliable transportation');
    if(c.metadata.id==='case-01') {
     const failure = "I don't know, I'm not sure how far I can travel right now. I'm in a lot of pain.";
     assert(!assessPatientOutputIntegrity(failure,visible,[],required).valid);
     assert(!assessPatientOutputIntegrity(fallback+' '+failure,visible,[],required).valid);
     assert(!assessPatientOutputIntegrity(failure,visible,[],[]).valid, 'Canonical contradiction check also applies outside a required-fact turn');
     assert(!assessPatientOutputIntegrity(fallback+" I'm not sure I can go to another county.",visible,[],required).valid);
     assert(!assessPatientOutputIntegrity(fallback+" I'm unsure how far I can go.",visible,[],required).valid);
     assert(!assessPatientOutputIntegrity(fallback+" I can only go five miles.",visible,[],required).valid);
     assert(!assessPatientOutputIntegrity("I can't travel.",visible,[],[]).valid);
     assert(assessPatientOutputIntegrity(fallback+" I don't know how far away the clinic is.",visible,[],required).valid);
     assert.throws(()=>assertPatientFinalResponse(fallback+' '+failure,{visibleFacts:visible,requiredFacts:required}));
    }
    count++;
   }
  }
  const q=`Do you live in ${county}?`;
  const s=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:q});
  assert.deepEqual(s.allowedThisTurn.map(f=>f.id),[c.supportingInfo.patientFacts!.find(f=>f.id.endsWith('.background-residence'))!.id]);
 }
 const mixed=classifyQuestion('Do you live in Alachua County, and can you travel outside your county?');
 assert(mixed.questionIntents.includes('background_residence') && mixed.questionIntents.includes('background_transportation'));
 assert(classifyQuestion('Does your pain travel to your ear?').questionIntents.includes('radiation'));
 assert(!hasTransportationUncertainty("I'm not sure whether the pain can travel to my ear."));
 assert(hasTransportationUncertainty("The pain travels to my ear, and I'm not sure how far I can travel for care."));
 console.log(`Travel validation passed: ${count} fresh/history checks, five residence controls, combined intent and clinical radiation.`);
}
void main();

