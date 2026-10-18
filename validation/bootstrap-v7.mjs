import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const v5='C:/Users/agomesdesiqueira/.codex/worktrees/odontiq-v6/odontiq';
const root='validation/v7';fs.mkdirSync(root,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const evidence=['REPORT.md','results.json','unresolved-items.json','completion.json'].map(p=>{const b=fs.readFileSync(`${v5}/validation/v6/${p}`);if(p.endsWith('.json'))JSON.parse(b);return {path:p,sha256:sha(b)};});
const freeze=JSON.parse(fs.readFileSync(`${v5}/validation/v6/implementation-freeze.json`));
const differences=Object.entries(freeze.files).filter(([p,h])=>sha(fs.readFileSync(p))!==h).map(([p])=>p);
// Git normalizes text line endings. Restore each tested source byte-for-byte before repairs.
for(const p of differences)fs.copyFileSync(`${v5}/${p}`,p);
for(const p of ['.env','.env.local'])if(fs.existsSync(`${v5}/${p}`))fs.copyFileSync(`${v5}/${p}`,p);
const source=`${v5}/node_modules`,target=path.resolve('node_modules');
if(fs.existsSync(target))throw Error('Dependency target already exists; inspect before altering');
fs.mkdirSync(target);let files=0;
function copy(a,b){for(const e of fs.readdirSync(a,{withFileTypes:true})){const x=path.join(a,e.name),y=path.join(b,e.name);if(e.isDirectory()){fs.mkdirSync(y);copy(x,y);}else if(e.isSymbolicLink())fs.symlinkSync(fs.readlinkSync(x),y,fs.statSync(x).isDirectory()?'junction':'file');else{fs.linkSync(x,y);files++;}}}
copy(source,target);
fs.writeFileSync(`${root}/baseline-provenance.json`,JSON.stringify({at:new Date().toISOString(),applicationCommit:freeze.commit,evidenceCommit:'0e36f5f1c52f06a62b1a97b6aab853c48473b616',requiredEvidenceRead:evidence,restoredLineEndingDifferences:differences,all370HashesMatched:Object.entries(freeze.files).every(([p,h])=>sha(fs.readFileSync(p))===h),dependencyFiles:files},null,2));
console.log({requiredEvidenceRead:evidence.length,restoredSourceFiles:differences.length,dependencyFiles:files});
