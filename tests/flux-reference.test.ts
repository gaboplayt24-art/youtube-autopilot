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
 try{const source=join(dir,'source.png');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=64x64','-frames:v','1',source]);const bytes=await readFile(source);const ledger=new FreeQuotaLedger(dir);let requests=0;
  const provider=new CloudflareReferenceImageProvider(async(url,init)=>{requests++;assert.ok(String(url).endsWith(FLUX_REFERENCE_MODEL));assert.ok(init!.body instanceof FormData);const form=init!.body as FormData;assert.equal(form.get('prompt'),'Paint the same person in profile');assert.equal(form.get('width'),'1024');assert.ok(form.get('input_image_0') instanceof Blob);assert.ok((form.get('input_image_0') as Blob).size>0);assert.equal((init!.headers as Record<string,string>)['Content-Type'],undefined);assert.equal(ledger.events[0].state,'reserved');assert.equal(ledger.events[0].reservedNeurons,160);return Response.json({success:true,result:{image:bytes.toString('base64')}});});
  await withQuota(ledger,()=>provider.generate('Paint the same person in profile',join(dir,'result.png'),{referenceImages:[source]}));assert.equal(requests,1);assert.equal(ledger.events[0].state,'completed');
  process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED='false';await assert.rejects(withQuota(ledger,()=>provider.generate('No paid fallback',join(dir,'blocked.png'))),/FREE plan/);assert.equal(requests,1);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;await rm(dir,{recursive:true,force:true});}
});
