import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listGeminiModels} from '../src/providers/diagnostics';
test('official Gemini model discovery paginates metadata with mocked HTTP and never performs inference',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='mock-not-a-real-key';let requests=0;
 try{const result=await listGeminiModels(async(input,init)=>{requests++;const url=new URL(String(input));assert.equal(url.pathname,'/v1beta/models');assert.equal((init!.headers as Record<string,string>)['x-goog-api-key'],'mock-not-a-real-key');assert.ok(!url.search.includes('key'));return Response.json(requests===1?{models:[{name:'models/free-candidate',supportedGenerationMethods:['generateContent']}],nextPageToken:'page2'}:{models:[{name:'models/embedding',supportedGenerationMethods:['embedContent']}]});});
 assert.equal(requests,2);assert.deepEqual(result.generateContentModels,['models/free-candidate']);assert.equal(result.metadataOnly,true);assert.equal(result.pricingReviewRequired,true);assert.equal(result.paidProviderCostUsd,0);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
