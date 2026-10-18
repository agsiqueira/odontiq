import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='validation/v5';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const checks=JSON.parse(fs.readFileSync(`${root}/automated-checks.json`));
if(checks.length!==38||checks.some(c=>c.exitCode!==0))throw Error('Automated checks incomplete');
const baseline=JSON.parse(fs.readFileSync(`${root}/v4-evidence-manifest.json`));
if(baseline.some(f=>sha(fs.readFileSync(f.path))!==f.sha256))throw Error('Copied V4 evidence changed');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
const source=[...files('src'),...files('scripts'),...files('prisma'),...files('public'),'package.json','package-lock.json','next.config.ts','tsconfig.json'];
const configuration={baseUrl:'http://localhost:3001',server:'Next16.2.10 development, Turbopack',provider:'navigator',model:'granite-3.3-8b-instruct',origin:'https://api.ai.it.ufl.edu',temperature:0.4,maxTokens:120,timeoutMs:30000,upstreamRetry:{maxAttempts:2,statuses:[502,503,504],backoffMs:250},browserWorkers:1,browserRetries:0,inventorySha256:sha(fs.readFileSync(`${root}/run-inventory.json`)),harness:JSON.parse(fs.readFileSync(`${root}/harness-configuration.json`))};
const freeze={version:'V5',frozenAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineCommit:'1715c396728f4d5e638655394cb9f6e6f02f3e35',baselineV4:'validation/shared-conversation-followup-2026-10-17/final-v4',configuration,files:Object.fromEntries(source.sort().map(p=>[p,sha(fs.readFileSync(p))]))};
fs.writeFileSync(`${root}/implementation-freeze.json`,JSON.stringify(freeze,null,2));
console.log({commit:freeze.commit,frozenAt:freeze.frozenAt,hashedFiles:source.length,checksPassed:checks.length});
