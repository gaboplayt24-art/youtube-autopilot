import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import {GroqProvider,GROQ_MODEL} from '../src/providers/groq';
import {configuredFreeProvider} from '../src/providers/free';
import {FreeQuotaLedger,withQuota} from '../src/quota';
async function fixture(fn:(dir:string,ledger:FreeQuotaLedger)=>Promise<void>){
 const names=['GROQ_API_KEY','GROQ_FREE_PLAN_CONFIRMED','FREE_ONLY','MAX_PAID_COST_USD','LLM_PROVIDER'],old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const dir=await mkdtemp(join(tmpdir(),'groq-provider-'));
 try{Object.assign(process.env,{GROQ_API_KEY:'mock-key',GROQ_FREE_PLAN_CONFIRMED:'true',FREE_ONLY:'true',MAX_PAID_COST_USD:'0',LLM_PROVIDER:'groq'});const ledger=new FreeQuotaLedger(dir,join(dir,'quota.json'));await withQuota(ledger,()=>fn(dir,ledger));}
 finally{for(const k of names){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}await rm(dir,{recursive:true});}
}
const reply=(value:unknown,finish_reason='stop')=>Response.json({model:GROQ_MODEL,choices:[{message:{content:JSON.stringify(value)},finish_reason}],usage:{prompt_tokens:100,completion_tokens:30}});
test('Groq JSON/vision use the existing contracts, record distinct provenance and reuse only matching cache',()=>fixture(async(dir,ledger)=>{
 let calls=0;
 const request:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://api.groq.com/openai/v1/chat/completions');assert.equal(init?.redirect,'error');const body=JSON.parse(String(init?.body));assert.equal(body.model,GROQ_MODEL);assert.equal(body.response_format.type,'json_object');assert.equal(body.max_completion_tokens,900);assert.match(body.messages[1].content.at(-1).text,/"required"/);assert.equal(body.messages[1].content[1].image_url.url,'data:image/png;base64,aW1hZ2U=');return reply({passed:false,issues:['wrong historical prop'],score:72});};
 const shape=z.object({passed:z.boolean(),issues:z.array(z.string()),score:z.number().nullable()}),provider=new GroqProvider(request);
 const image=[{mimeType:'image/png',data:'aW1hZ2U='}];
 const first=await provider.images('Review actual source',image,shape);assert.equal(first.passed,false);
 assert.deepEqual(await new GroqProvider(request).images('Review actual source',image,shape),first);assert.equal(calls,1);
 await provider.images('Different request',image,shape);assert.equal(calls,2);assert.ok(ledger.events.every(e=>e.provider==='groq'&&e.paidUsd===0));
 await ledger.report();const report=JSON.parse(await readFile(join(dir,'free-quota-report.json'),'utf8'));assert.equal(report.groq.requests,2);assert.equal(report.groq.inputTokens,200);assert.equal(report.gemini.inputTokens,0);
 assert.equal((await readdir(join(dir,'groq-responses'))).length,2);
}));
test('Groq preserves schema rejection and truncation evidence instead of producing a pass',()=>fixture(async(dir)=>{
 await assert.rejects(new GroqProvider(async()=>reply({passed:'yes'})).json('wrong types',z.object({passed:z.boolean()})),z.ZodError);
 await assert.rejects(new GroqProvider(async()=>reply({passed:true},'length')).json('truncated',z.object({passed:z.boolean()})),/incomplete/);
 assert.equal((await readdir(join(dir,'groq-responses'))).length,2);
 await assert.rejects(new GroqProvider(async()=>reply({passed:true})).images('too many',Array.from({length:4},()=>({mimeType:'image/png',data:''})),z.object({passed:z.boolean()})),/input limit/);
}));
test('Groq requires attested Free plan, never changes model and stops after bounded 429 retries',()=>fixture(async()=>{
 let calls=0;const waits:number[]=[];
 const provider=new GroqProvider(async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'1'}});},async ms=>{waits.push(ms);});
 await assert.rejects(provider.json('quota',z.object({passed:z.boolean()})),/HTTP 429/);assert.equal(calls,3);assert.equal(waits.length,2);
 process.env.GROQ_FREE_PLAN_CONFIRMED='false';await assert.rejects(provider.json('blocked',z.object({passed:z.boolean()})),/Free-only/);assert.equal(calls,3);
 assert.ok(configuredFreeProvider() instanceof GroqProvider);process.env.LLM_PROVIDER='unknown';assert.throws(()=>configuredFreeProvider(),/Unsupported/);
}));
test('top-level array contracts are wrapped for JSON-object mode and unwrapped before validation',()=>fixture(async()=>{
 const provider=new GroqProvider(async()=>reply({result:['valid']}));assert.deepEqual(await provider.json('array result',z.array(z.string())),['valid']);
}));

test('multiple images have explicit ordinals followed by review instructions, preserving reference/candidate order',()=>fixture(async()=>{
 const images=[{mimeType:'image/png',data:Buffer.from('reference').toString('base64')},{mimeType:'image/png',data:Buffer.from('candidate').toString('base64')}];
 const provider=new GroqProvider(async(_url,init)=>{const content=JSON.parse(String(init?.body)).messages[1].content;assert.match(content[0].text,/IMAGE 1 of 2/);assert.equal(content[1].image_url.url,'data:image/png;base64,'+images[0].data);assert.match(content[2].text,/IMAGE 2 of 2/);assert.equal(content[3].image_url.url,'data:image/png;base64,'+images[1].data);assert.match(content.at(-1).text,/Inspect candidate image 2/);return reply({passed:true});});
 assert.deepEqual(await provider.images('Inspect candidate image 2',images,z.object({passed:z.boolean()})),{passed:true});
}));

test('token pacing replenishes gradually and reconciles actual usage instead of sleeping a full minute per image',()=>fixture(async()=>{
 let now=Date.now();const waits:number[]=[];
 const provider=new GroqProvider(async()=>Response.json({model:GROQ_MODEL,choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:4500,completion_tokens:500}}),async ms=>{waits.push(ms);now+=ms;},()=>now);
 for(let i=0;i<3;i++)await provider.json('independent request '+i,z.object({ok:z.boolean()}));
 assert.ok(waits.length>0);assert.ok(waits.every(ms=>ms>0&&ms<61000));
}));
