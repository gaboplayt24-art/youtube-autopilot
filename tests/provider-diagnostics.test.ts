import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listGeminiModels} from '../src/providers/diagnostics';
import {GeminiProvider} from '../src/providers/free';
import {z} from 'zod';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FreeQuotaLedger,withQuota} from '../src/quota';
import {compatibleGeminiModels,retryDelay,quotaReset} from '../src/providers/gemini-reliability';
import {readFile} from 'node:fs/promises';
const discovery=()=>Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]});
test('truncated storyboard JSON retries the same confirmed model with bounded output budget and preserves evidence',async()=>{
 const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED;const dir=await mkdtemp(join(tmpdir(),'gemini-truncated-'));process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';
 try{const ledger=new FreeQuotaLedger(dir),budgets:number[]=[];const provider=new GeminiProvider(async(input,init)=>{if(new URL(String(input)).pathname==='/v1beta/models')return discovery();budgets.push(JSON.parse(String(init!.body)).generationConfig.maxOutputTokens);return Response.json({candidates:[{finishReason:budgets.length===1?'MAX_TOKENS':'STOP',content:{parts:[{text:budgets.length===1?'{"ok":':'{"ok":true}'}]}}]});},async()=>{});
  assert.deepEqual(await withQuota(ledger,()=>provider.json('large storyboard',z.object({ok:z.boolean()}))),{ok:true});assert.deepEqual(budgets,[16384,32768]);assert.equal(ledger.events.length,2);assert.match(await readFile(join(dir,'logs.jsonl'),'utf8'),/gemini_json_rejected/);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;await rm(dir,{recursive:true});}
});
test('official Gemini model discovery paginates metadata with mocked HTTP and never performs inference',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='mock-not-a-real-key';let requests=0;
 try{const result=await listGeminiModels(async(input,init)=>{requests++;const url=new URL(String(input));assert.equal(url.pathname,'/v1beta/models');assert.equal((init!.headers as Record<string,string>)['x-goog-api-key'],'mock-not-a-real-key');assert.ok(!url.search.includes('key'));return Response.json(requests===1?{models:[{name:'models/free-candidate',supportedGenerationMethods:['generateContent']}],nextPageToken:'page2'}:{models:[{name:'models/embedding',supportedGenerationMethods:['embedContent']}]});});
 assert.equal(requests,2);assert.deepEqual(result.generateContentModels,['models/free-candidate']);assert.equal(result.metadataOnly,true);assert.equal(result.pricingReviewRequired,true);assert.equal(result.paidProviderCostUsd,0);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('Gemini errors retain the selected model and provider reason while redacting keys',async()=>{
 const names=['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_FREE_TIER_CONFIRMED'];const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));const previous=globalThis.fetch;
 try{process.env.GEMINI_API_KEY='mock-private-value';process.env.GEMINI_FREE_TIER_CONFIRMED='true';delete process.env.GEMINI_MODEL;
 globalThis.fetch=async(input)=>{if(new URL(String(input)).pathname==='/v1beta/models')return discovery();assert.match(String(input),/gemini-3\.8-flash:generateContent$/);assert.ok(!String(input).includes('mock-private-value'));return Response.json({error:{message:'Model unavailable for mock-private-value'}},{status:404});};
 await assert.rejects(new GeminiProvider().json('test',z.object({ok:z.boolean()})),(e:Error)=>e.message.includes('Gemini HTTP 404 for gemini-3.8-flash')&&e.message.includes('[redacted]')&&!e.message.includes('mock-private-value'));
 }finally{globalThis.fetch=previous;for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('Gemini retries temporary 503 on the same model with every attempt accounted for',async()=>{
 const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED;const dir=await mkdtemp(join(tmpdir(),'gemini-retry-'));process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';
 try{const ledger=new FreeQuotaLedger(dir);let attempts=0,waits=0;const urls:string[]=[];
 const provider=new GeminiProvider(async(input)=>{if(new URL(String(input)).pathname==='/v1beta/models')return discovery();urls.push(String(input));return ++attempts<3?Response.json({error:{message:'Temporary high demand'}},{status:503}):Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{promptTokenCount:5,candidatesTokenCount:2}});},async()=>{waits++;});
 assert.deepEqual(await withQuota(ledger,()=>provider.json('test',z.object({ok:z.boolean()}))),{ok:true});assert.equal(attempts,3);assert.equal(waits,2);assert.equal(new Set(urls).size,1);assert.deepEqual(ledger.events.map(e=>e.state),['failed','failed','completed']);assert.equal(ledger.events.at(-1)!.outputTokens,2);
 await withQuota(ledger,()=>provider.json('test',z.object({ok:z.boolean()})));assert.equal(attempts,3,'successful JSON call must resume without inference');
 let quotaAttempts=0;const quotaProvider=new GeminiProvider(async(input)=>{if(new URL(String(input)).pathname==='/v1beta/models')return discovery();quotaAttempts++;return Response.json({error:{message:'Quota exceeded'}},{status:429});},async()=>{});await assert.rejects(withQuota(ledger,()=>quotaProvider.json('different-call',z.object({ok:z.boolean()}))),/429/);assert.equal(quotaAttempts,6);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;await rm(dir,{recursive:true});}
});
test('fallback uses only discovered compatible models and honors Retry-After',()=>{assert.deepEqual(compatibleGeminiModels(['models/gemini-3.5-flash','models/unknown']),['gemini-3.5-flash']);assert.equal(retryDelay(0,'12',()=>0),12000);assert.equal(retryDelay(4,null,()=>0),40000);});
test('API-reported daily free quota reset survives checkpoints without treating transient failures as exhaustion',()=>{
 assert.equal(quotaReset('generate_content_free_tier_requests Please retry in 20h47m25.5s.','2026-10-07T03:12:34.500Z'),'2026-10-08T00:00:00.000Z');
 assert.equal(quotaReset('503 busy','2026-10-07T03:12:34.500Z'),null);
 assert.equal(quotaReset('free_tier_requests Please retry in 5s.','2026-10-07T03:12:34.500Z'),null);
});
test('Gemini exhausts same-model retries before a discovered fallback and never calls absent IDs',async()=>{const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED;process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';try{const urls:string[]=[];const waits:number[]=[];const provider=new GeminiProvider(async(input)=>{const url=String(input);if(new URL(url).pathname==='/v1beta/models')return Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.6-flash',supportedGenerationMethods:['embedContent']}]});urls.push(url);return url.includes('gemini-3.8-flash:')?Response.json({error:{message:'temporary'}},{status:502,headers:{'Retry-After':'3'}}):Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});},async ms=>{waits.push(ms);});assert.deepEqual(await provider.json('fallback fixture',z.object({ok:z.boolean()})),{ok:true});assert.equal(urls.length,7);assert.ok(urls.slice(0,6).every(u=>u.includes('gemini-3.8-flash:')));assert.ok(urls[6].includes('gemini-3.5-flash:'));assert.equal(waits.length,5);assert.ok(waits[0]>=3000);}finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;}});
test('a reported long free-quota reset skips only the exhausted model immediately and survives resume',async()=>{
 const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED,dir=await mkdtemp(join(tmpdir(),'gemini-daily-fallback-'));process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';
 try{const ledger=new FreeQuotaLedger(dir),calls:string[]=[];let waits=0;const request:typeof fetch=async input=>{const url=String(input);if(new URL(url).pathname==='/v1beta/models')return Response.json({models:['gemini-3.8-flash','gemini-3.5-flash'].map(name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']}))});calls.push(url);return url.includes('gemini-3.8-flash:')?Response.json({error:{message:'generate_content_free_tier_requests, limit: 20. Please retry in 16h30m0s.'}},{status:429}):Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});};await withQuota(ledger,()=>new GeminiProvider(request,async()=>{waits++;}).json('first',z.object({ok:z.boolean()})));assert.equal(calls.length,2);assert.equal(waits,0);await withQuota(ledger,()=>new GeminiProvider(request,async()=>{waits++;}).json('second',z.object({ok:z.boolean()})));assert.equal(calls.length,3);assert.ok(calls[2].includes('gemini-3.5-flash:'));assert.equal(waits,0);assert.match(await readFile(join(dir,'logs.jsonl'),'utf8'),/gemini_model_quota_unavailable/);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;await rm(dir,{recursive:true,force:true});}
});
test('a lone object wrapped in a one-element array is unwrapped, but a real array or wrong object still fails the schema',async()=>{
 const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED;const dir=await mkdtemp(join(tmpdir(),'gemini-array-'));process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';
 try{const reply=(text:string)=>new GeminiProvider(async input=>new URL(String(input)).pathname==='/v1beta/models'?discovery():Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}),async()=>{});const schema=z.object({passed:z.boolean()});
  assert.deepEqual(await withQuota(new FreeQuotaLedger(dir),()=>reply('[{"passed":false}]').json('a',schema)),{passed:false});
  await assert.rejects(withQuota(new FreeQuotaLedger(dir),()=>reply('[{"passed":true},{"passed":false}]').json('b',schema)));
  await assert.rejects(withQuota(new FreeQuotaLedger(dir),()=>reply('[{"other":1}]').json('c',schema)));
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;await rm(dir,{recursive:true});}
});
