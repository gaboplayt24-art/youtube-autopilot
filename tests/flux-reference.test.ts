import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CloudflareReferenceImageProvider,FLUX_REFERENCE_MODEL} from '../src/providers/cloudflare';
import {FreeQuotaLedger,withQuota} from '../src/quota';
import {exec} from '../src/orchestration/io';
test('Klein sends real reference bytes with official multipart names and reserves free quota before inference',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'klein-reference-'));const keys=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_FREE_PLAN_CONFIRMED'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.CLOUDFLARE_ACCOUNT_ID='mock';process.env.CLOUDFLARE_API_TOKEN='mock';process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED='true';
 try{const source=join(dir,'source.png');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=1536x864','-frames:v','1',source]);const bytes=await readFile(source);const ledger=new FreeQuotaLedger(dir);let requests=0;
  const provider=new CloudflareReferenceImageProvider(async(url,init)=>{requests++;assert.ok(String(url).endsWith(FLUX_REFERENCE_MODEL));assert.ok(init!.body instanceof FormData);const form=init!.body as FormData;assert.equal(form.get('prompt'),'Paint the same person in profile');assert.equal(form.get('width'),'1536');assert.equal(form.get('height'),'864');assert.ok(form.get('input_image_0') instanceof Blob);assert.ok((form.get('input_image_0') as Blob).size>0);assert.equal((init!.headers as Record<string,string>)['Content-Type'],undefined);assert.equal(ledger.events[0].state,'reserved');assert.equal(ledger.events[0].reservedNeurons,224);return Response.json({success:true,result:{image:bytes.toString('base64')}});});
  await withQuota(ledger,()=>provider.generate('Paint the same person in profile',join(dir,'result.png'),{referenceImages:[source],width:1536,height:864}));assert.equal(requests,1);assert.equal(ledger.events[0].state,'completed');
  process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED='false';await assert.rejects(withQuota(ledger,()=>provider.generate('No paid fallback',join(dir,'blocked.png'),{referenceImages:[source],width:1536,height:864})),/FREE plan/);assert.equal(requests,1);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;await rm(dir,{recursive:true,force:true});}
});

test('Klein preserves small JPEG reference bytes and refuses a square returned source without cropping',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'klein-native-rejection-'));const keys=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_FREE_PLAN_CONFIRMED'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{process.env.CLOUDFLARE_ACCOUNT_ID='mock';process.env.CLOUDFLARE_API_TOKEN='mock';process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED='true';const reference=join(dir,'reference.jpg'),square=join(dir,'square.png');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=384x240','-frames:v','1',reference]);await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=1024x1024','-frames:v','1',square]);const bytes=await readFile(reference),ledger=new FreeQuotaLedger(dir);let calls=0;const provider=new CloudflareReferenceImageProvider(async(_url,init)=>{calls++;const blob=(init!.body as FormData).get('input_image_0') as Blob;assert.equal(blob.type,'image/jpeg');assert.deepEqual(Buffer.from(await blob.arrayBuffer()),bytes);return Response.json({success:true,result:{image:(await readFile(square)).toString('base64')}});});const target=join(dir,'rejected.png');await assert.rejects(withQuota(ledger,()=>provider.generate('original mature historical illustration',target,{referenceImages:[reference],width:1536,height:864})),/wrong native dimensions/);assert.equal(calls,1);assert.deepEqual(await readFile(target),await readFile(square));const evidence=JSON.parse(await readFile(target+'.dimensions.json','utf8'));assert.equal(evidence.width,1024);assert.equal(evidence.requestedWidth,1536);await assert.rejects(withQuota(ledger,()=>provider.generate('square forbidden',target,{referenceImages:[reference],width:1024,height:1024})),/native 16:9/);assert.equal(calls,1);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;await rm(dir,{recursive:true,force:true});}
});
