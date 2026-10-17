import fs from 'node:fs';
import { loadCase } from '../../src/data/cases';
import { buildPatientDisclosureState } from '../../src/lib/patientDisclosure';
import { loadCase as oldLoad } from './earlier-head/src/data/cases';
import { buildPatientDisclosureState as oldBuild } from './earlier-head/src/lib/patientDisclosure';
const conversation = [
 { id:'s',role:'student' as const,text:'Are you drooling?',timestamp:'2026-07-16T12:00:00.000Z' },
 { id:'p',role:'patient' as const,text:'Yes, I cannot stop drooling.',timestamp:'2026-07-16T12:00:01.000Z' },
];
const current=buildPatientDisclosureState({caseData:loadCase('case-01')!,conversation,latestStudentMessage:'Are you drooling?'});
const earlier=oldBuild({caseData:oldLoad('case-01')!,conversation,latestStudentMessage:'Are you drooling?'});
const project=(s:typeof current)=>({allowed:s.allowedThisTurn.map(f=>f.id),disclosed:s.alreadyDisclosed.map(f=>f.id),topics:s.latestTopics,isBroad:s.isBroadQuestion,intent:s.providerMessageIntent,background:s.backgroundTurn??null});
const result={actualEarlierRevision:'edae56cb34e9a99ada0e1e2e10544686b126dd61',earlier:project(earlier),current:project(current),priorWorkingTreeDisclosedPredicate:current.alreadyDisclosed.filter(f=>!current.allowedThisTurn.some(a=>a.id===f.id)).map(f=>f.id),explanation:'Earlier revision excludes already spoken drooling from allowedThisTurn; accumulated working-tree classification selects it again. The former alreadyDisclosed predicate then removed selected facts from continuity. Continuity is now independently retained whether or not selected again. No new fact is marked disclosed by asking alone.'};
fs.writeFileSync('validation/shared-conversation-followup-2026-10-17/continuity-diagnosis.json',JSON.stringify(result,null,2));
console.log(result);
