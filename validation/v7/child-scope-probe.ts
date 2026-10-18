import {loadCase} from '../../src/data/cases';import {assessCanonicalAssertions} from '../../src/lib/patientCanonicalAssertions';
const f=loadCase('case-03')!.supportingInfo.patientFacts!;
for(const text of ['My daughter needs a filling.','She has a toothache.','She needs treatment.',"I'm not sure, but my daughter has cavities.","I'd prefer the same clinic because my daughter has cavities.","I'm not sure whether my daughter has cavities."])console.log({text,...assessCanonicalAssertions(text,f)});
