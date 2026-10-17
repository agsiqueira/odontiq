import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { CASE_DATA } from '../src/data/cases';
import { buildPatientDisclosureState } from '../src/lib/patientDisclosure';
import { requiredFactsForTurn } from '../src/lib/patientTurnFacts';
import { validatePatientFinalResponse } from '../src/lib/patientFinalResponse';

// Revalidate captured, real Navigator/UI responses with the final guard version.
// This does not generate responses, change encounters, or replace live results.
const root = 'validation/transportation-2026-10-17';
const input = JSON.parse(readFileSync(`${root}/live-results.json`, 'utf8')) as {
 runs: Array<{scenarioId:string;encounterId:string;turns:Array<{id:string;question:string;actualFinalPatientResponse:string}>}>;
};
const c = CASE_DATA[0];
const results = input.runs.filter(run=>run.scenarioId.startsWith('transportation-capability')).flatMap(run=>run.turns.map(turn=>{
 const state=buildPatientDisclosureState({caseData:c,conversation:[],latestStudentMessage:turn.question});
 return {encounterId:run.encounterId,turnId:turn.id,...validatePatientFinalResponse(turn.actualFinalPatientResponse,{visibleFacts:c.supportingInfo.patientFacts,requiredFacts:requiredFactsForTurn(state,turn.question,c.supportingInfo.patientFacts)})};
}));
writeFileSync(`${root}/recorded-response-revalidation.json`,JSON.stringify({count:results.length,results},null,2));
assert(results.length>=39);
assert(results.every(result=>result.valid),JSON.stringify(results.filter(result=>!result.valid)));
console.log(`Final guard accepted all ${results.length} captured real Navigator/UI capability and pain responses.`);
