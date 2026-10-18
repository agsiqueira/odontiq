import assert from 'node:assert/strict';
import path from 'node:path';
import {createJiti} from 'jiti';
const jiti=createJiti(import.meta.url,{alias:{'server-only':path.resolve('scripts/fixtures/serverOnlyStub.mjs'),'@':path.resolve('src')}});
const {NavigatorProvider}=await jiti.import('../src/lib/ai/navigatorProvider.ts');
const oldFetch=globalThis.fetch;
const saved={};for(const key of ['NAVIGATOR_API_KEY','NAVIGATOR_BASE_URL','NAVIGATOR_MODEL'])saved[key]=process.env[key];
process.env.NAVIGATOR_API_KEY='synthetic-key';process.env.NAVIGATOR_BASE_URL='https://invalid.local';process.env.NAVIGATOR_MODEL='patient-model';
const models=[];
globalThis.fetch=async(_url,init)=>{models.push(JSON.parse(init.body).model);return new Response(JSON.stringify({choices:[{message:{content:'Okay.'}}]}),{status:200,headers:{'content-type':'application/json'}});};
try{
 const provider=new NavigatorProvider();
 await provider.generateText({systemPrompt:'test',messages:[],model:'independent-verifier'});
 await provider.generateText({systemPrompt:'test',messages:[]});
 await provider.generateConversationResponse({systemPrompt:'test',messages:[],requestId:'test',model:'untrusted-public-input'});
 assert.deepEqual(models,['independent-verifier','patient-model','patient-model']);
 console.log('Internal model override honored; default and patient conversation model unchanged; public-like override not forwarded.');
}finally{
 globalThis.fetch=oldFetch;
 for(const key of Object.keys(saved)){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
}
