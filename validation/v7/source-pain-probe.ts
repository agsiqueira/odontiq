import {loadCase} from '../../src/data/cases';
import {expressesRequiredFact} from '../../src/lib/patientOutputGuard';
const facts=loadCase('case-05')!.supportingInfo.patientFacts!.filter(f=>/^c5\.(?:location|duration|constant|quality|severity|spontaneous|nocturnal|cold|lingering|chewing|biting)$/.test(f.id));
console.log(facts.map(f=>({id:f.id,source:f.text,recognized:expressesRequiredFact(f.text,f)})));
