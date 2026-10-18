from pathlib import Path
p=Path('scripts/validateV8PatientRepair.ts');s=p.read_text();start=s.index('async function main()');s=s[:start]+'''async function main(){
let calls=0;
const stripped=await generatePatientRoleSafeResponse({initialOutput:"I'm open to paying a sliding-scale fee. Do I need an antibiotic?",retry:async()=>{throw Error('Valid answer should be preserved without retry');},allowPatientInitiatedQuestion:false});
assert.equal(stripped.text,"I'm open to paying a sliding-scale fee.");
const result=await generatePatientRoleSafeResponse({initialOutput:'As a dentist, I recommend a root canal.',retry:async()=>{calls++;return 'As a dentist, I recommend a root canal.';},fallbackText:"I'm open to paying a sliding-scale fee.",allowPatientInitiatedQuestion:false});
assert.equal(result.text,"I'm open to paying a sliding-scale fee.");assert.equal(calls,1);assert(result.repeatedDrift);
assert.equal(constrain(negative[0]).detectedEvents.painManagementOrDispositionDiscussed,false);
fs.writeFileSync('validation/v8/focused-regressions.json',JSON.stringify({at:new Date().toISOString(),passed:true,negativeCases:negative,positiveCases:positive,coverage:['scope/clinical action','mixed messages','hypothetical versus actual','stale state','later eligibility','once only','input immutability','unsafe generation question stripping','repeated unsafe generation and actual fallback']},null,2));console.log('V8 boundary regressions passed.');}
main().catch(e=>{console.error(e);process.exitCode=1;});
''';p.write_text(s)
