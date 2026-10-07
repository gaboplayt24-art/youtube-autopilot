import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listGeminiModels} from '../src/providers/diagnostics';
import {GeminiProvider} from '../src/providers/free';
import {z} from 'zod';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FreeQuotaLedger,withQuota} from '../src/quota';
import {compatibleGeminiModels,retryDelay} from '../src/providers/gemini-reliability';
const discovery=()=>Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]});
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
test('Gemini exhausts same-model retries before a discovered fallback and never calls absent IDs',async()=>{const old=process.env.GEMINI_API_KEY,flag=process.env.GEMINI_FREE_TIER_CONFIRMED;process.env.GEMINI_API_KEY='mock';process.env.GEMINI_FREE_TIER_CONFIRMED='true';try{const urls:string[]=[];const waits:number[]=[];const provider=new GeminiProvider(async(input)=>{const url=String(input);if(new URL(url).pathname==='/v1beta/models')return Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.6-flash',supportedGenerationMethods:['embedContent']}]});urls.push(url);return url.includes('gemini-3.8-flash:')?Response.json({error:{message:'temporary'}},{status:502,headers:{'Retry-After':'3'}}):Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});},async ms=>{waits.push(ms);});assert.deepEqual(await provider.json('fallback fixture',z.object({ok:z.boolean()})),{ok:true});assert.equal(urls.length,7);assert.ok(urls.slice(0,6).every(u=>u.includes('gemini-3.8-flash:')));assert.ok(urls[6].includes('gemini-3.5-flash:'));assert.equal(waits.length,5);assert.ok(waits[0]>=3000);}finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;if(flag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=flag;}});
