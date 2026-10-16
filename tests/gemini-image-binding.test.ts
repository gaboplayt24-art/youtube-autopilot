import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {GeminiProvider} from '../src/providers/free';
import {FreeQuotaLedger,withQuota} from '../src/quota';
import {json,read} from '../src/orchestration/io';

test('Gemini binds reference and candidate bytes to explicit image numbers without reusing an old ambiguous response',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gemini-image-binding-'));
 const previousKey=process.env.GEMINI_API_KEY,previousFlag=process.env.GEMINI_FREE_TIER_CONFIRMED;
 process.env.GEMINI_API_KEY='fixture';process.env.GEMINI_FREE_TIER_CONFIRMED='true';
 try{
  const instruction='Review candidate IMAGE 2 against reference IMAGE 1';
  const images=[{mimeType:'image/png',data:Buffer.from('reference-bytes').toString('base64')},{mimeType:'image/png',data:Buffer.from('candidate-bytes').toString('base64')}];
  const legacyHash=createHash('sha256').update(JSON.stringify({instruction,images})).digest('hex');
  const legacyPath=join(dir,'gemini-cache',legacyHash+'.json');
  await json(legacyPath,{hash:legacyHash,model:'gemini-3.8-flash',value:{passed:false}});
  let calls=0;
  const provider=new GeminiProvider(async(input,init)=>{
   if(new URL(String(input)).pathname==='/v1beta/models')return Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]});
   calls++;const parts=JSON.parse(String(init!.body)).contents[0].parts;
   assert.match(parts[0].text,/IMAGE 1 of 2/);assert.deepEqual(parts[1].inlineData,images[0]);
   assert.match(parts[2].text,/IMAGE 2 of 2/);assert.deepEqual(parts[3].inlineData,images[1]);assert.equal(parts[4].text,instruction);
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"passed":true}'}]}}]});
  },async()=>{});
  const ledger=new FreeQuotaLedger(dir),schema=z.object({passed:z.boolean()});
  await withQuota(ledger,async()=>{assert.deepEqual(await provider.images(instruction,images,schema),{passed:true});assert.deepEqual(await provider.images(instruction,images,schema),{passed:true});});
  assert.equal(calls,1);assert.deepEqual((await read(legacyPath)).value,{passed:false});
 }finally{
  if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;
  if(previousFlag===undefined)delete process.env.GEMINI_FREE_TIER_CONFIRMED;else process.env.GEMINI_FREE_TIER_CONFIRMED=previousFlag;
  await rm(dir,{recursive:true,force:true});
 }
});
