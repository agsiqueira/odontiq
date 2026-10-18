import fs from 'node:fs';
import crypto from 'node:crypto';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(),false);
const root='validation/v8',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freeze=JSON.parse(fs.readFileSync(`${root}/implementation-freeze.json`));
if(Object.entries(freeze.files).some(([p,h])=>sha(fs.readFileSync(p))!==h))throw Error('Frozen source differs');
const artifacts={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())walk(p);else artifacts[p]=sha(fs.readFileSync(p));}}
walk('.next/server');walk('.next/static');for(const p of ['.next/BUILD_ID','.next/build-manifest.json','.next/routes-manifest.json','.next/prerender-manifest.json'])if(fs.existsSync(p))artifacts[p]=sha(fs.readFileSync(p));
const result={capturedAt:new Date().toISOString(),testedCommit:freeze.commit,sourceHashesUnchanged:true,baseUrl:'http://localhost:3007',command:'node node_modules/next/dist/bin/next start --port 3007',NODE_ENV:'production',nextVersion:JSON.parse(fs.readFileSync('node_modules/next/package.json')).version,buildId:fs.readFileSync('.next/BUILD_ID','utf8').trim(),buildCheck:JSON.parse(fs.readFileSync(`${root}/automated-checks.json`)).find(c=>c.name==='build'),provider:freeze.configuration.provider,model:freeze.configuration.model,origin:freeze.configuration.origin,temperature:freeze.configuration.temperature,maxTokens:freeze.configuration.maxTokens,timeoutMs:freeze.configuration.timeoutMs,upstreamRetry:freeze.configuration.upstreamRetry,localEnvFiles:Object.fromEntries(['.env','.env.local','.env.production','.env.production.local'].filter(p=>fs.existsSync(p)).map(p=>[p,sha(fs.readFileSync(p))])),artifacts};
result.inventorySha256=sha(fs.readFileSync(`${root}/production-inventory.json`));
result.actualProviderEnvironment={AI_PROVIDER:process.env.AI_PROVIDER,NAVIGATOR_MODEL:process.env.NAVIGATOR_MODEL,providerOrigin:new URL(process.env.NAVIGATOR_BASE??process.env.NAVIGATOR_BASE_URL??'https://api.ai.it.ufl.edu').origin};
result.harness=JSON.parse(fs.readFileSync(`${root}/production-harness.json`));
result.harness.files=result.harness.files.map(f=>({...f,sha256:sha(fs.readFileSync(f.path))}));
result.retainedSpeechEvidence={path:'validation/v6/speech-test.json',sha256:sha(fs.readFileSync('validation/v6/speech-test.json')),repeatedInV8:false,humanAudibility:'UNVERIFIED'};
fs.writeFileSync(`${root}/production-configuration.json`,JSON.stringify(result,null,2));console.log({buildId:result.buildId,compiledArtifacts:Object.keys(artifacts).length});
