import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const source='C:/Users/agomesdesiqueira/Downloads/OdontIQ_340_Question_Variations.md';
const out=path.resolve('validation/question-variations-2026-10-17');
mkdirSync(out,{recursive:true});
const original=readFileSync(source,'utf8');
const groups=[]; let current;
for(const line of original.split(/\r?\n/)) {
 const header=line.match(/^## Case (\d{2}) — (.+)$/);
 if(header){current={caseId:`case-${header[1]}`,title:header[2],expectedMeaning:'',contextRequirement:'',questions:[]};groups.push(current);}
 if(!current)continue;
 if(line.startsWith('Expected meaning: '))current.expectedMeaning=line.slice(18);
 if(line.startsWith('Context: '))current.contextRequirement=line.slice(9);
 const row=line.match(/^\| (C\d{2}-G\d{2}-Q\d{2}) \| (.*) \|$/);
 if(row)current.questions.push({testId:row[1],question:row[2]});
}
const primary=groups.flatMap(g=>g.questions.map(q=>({...q,caseId:g.caseId,groupId:q.testId.slice(4,7),groupTitle:g.title,expectedMeaning:g.expectedMeaning,contextRequirement:g.contextRequirement,cohort:'primary',setupQuestions:setup(q.testId)})));
function setup(id){
 if(/^C02-G05-Q(?:03|11|16)$/.test(id))return ['Have you ever had Medicaid?','What happened to that coverage?'];
 if(id==='C02-G06-Q16')return ['What county do you live in?'];
 if(/^C03-G10-Q(?:14|17)$/.test(id))return ['Do you have any children?'];
 if(id.startsWith('C03-G11-'))return ['Do you have any children?',"I'm looking into dental care options for you and your daughter."];
 return [];
}
if(groups.length!==17||primary.length!==340||new Set(primary.map(q=>q.testId)).size!==340||groups.some(g=>g.questions.length!==20)||new Set(groups.map(g=>g.caseId)).size!==5)throw Error('Question inventory mismatch');
const pain=primary.filter(q=>q.groupId==='G03').map(q=>({...q,testId:`${q.testId}-PAIN`,primaryTestId:q.testId,cohort:'pain-context',setupQuestions:['How severe is your pain right now?','How are you feeling with the pain?']}));
writeFileSync(path.join(out,'source-question-file.md'),original);
writeFileSync(path.join(out,'inventory.json'),JSON.stringify({source,sourceSha256:createHash('sha256').update(original).digest('hex'),primaryCount:340,painContextCount:20,groupCount:17,caseCount:5,groups,tests:[...primary,...pain]},null,2));
const appFiles=[];
function visit(dir){for(const file of readdirSync(dir)){const full=path.join(dir,file);if(statSync(full).isDirectory())visit(full);else appFiles.push(full);}}
visit('src');appFiles.push('package.json','package-lock.json','next.config.ts');
const files=appFiles.map(file=>({path:file.replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
writeFileSync(path.join(out,'application-before.json'),JSON.stringify({capturedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeStatus:execFileSync('git',['status','--short'],{encoding:'utf8'}),files,caseFacts:[1,2,3,4,5].map(n=>{const file=`src/data/cases/case-0${n}/case.json`;const c=JSON.parse(readFileSync(file,'utf8'));return {caseId:`case-0${n}`,backgroundFacts:c.supportingInfo.patientFacts.filter(f=>f.id.includes('.background-'))};})},null,2));
console.log(JSON.stringify({groups:groups.length,primary:primary.length,uniquePrimaryIds:new Set(primary.map(q=>q.testId)).size,pain:pain.length,byCase:groups.map(g=>g.caseId).reduce((a,c)=>(a[c]=(a[c]??0)+20,a),{})}));
