import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listGeminiModels} from '../src/providers/diagnostics';
import {GeminiProvider} from '../src/providers/free';
import {z} from 'zod';
test('official Gemini model discovery paginates metadata with mocked HTTP and never performs inference',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='mock-not-a-real-key';let requests=0;
 try{const result=await listGeminiModels(async(input,init)=>{requests++;const url=new URL(String(input));assert.equal(url.pathname,'/v1beta/models');assert.equal((init!.headers as Record<string,string>)['x-goog-api-key'],'mock-not-a-real-key');assert.ok(!url.search.includes('key'));return Response.json(requests===1?{models:[{name:'models/free-candidate',supportedGenerationMethods:['generateContent']}],nextPageToken:'page2'}:{models:[{name:'models/embedding',supportedGenerationMethods:['embedContent']}]});});
 assert.equal(requests,2);assert.deepEqual(result.generateContentModels,['models/free-candidate']);assert.equal(result.metadataOnly,true);assert.equal(result.pricingReviewRequired,true);assert.equal(result.paidProviderCostUsd,0);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('Gemini errors retain the selected model and provider reason while redacting keys',async()=>{
 const names=['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_FREE_TIER_CONFIRMED'];const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));const previous=globalThis.fetch;
 try{process.env.GEMINI_API_KEY='mock-private-value';process.env.GEMINI_FREE_TIER_CONFIRMED='true';delete process.env.GEMINI_MODEL;
 globalThis.fetch=async(input)=>{assert.match(String(input),/gemini-3\.8-flash:generateContent$/);assert.ok(!String(input).includes('mock-private-value'));return Response.json({error:{message:'Model unavailable for mock-private-value'}},{status:404});};
 await assert.rejects(new GeminiProvider().json('test',z.object({ok:z.boolean()})),(e:Error)=>e.message.includes('Gemini HTTP 404 for gemini-3.8-flash')&&e.message.includes('[redacted]')&&!e.message.includes('mock-private-value'));
 }finally{globalThis.fetch=previous;for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
