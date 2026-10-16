import {test} from 'node:test';import assert from 'node:assert/strict';
import {groqVisualAnswer,GROQ_PROBE_MODEL} from '../scripts/groq-vision-probe';
test('isolated vision audition requires a key and Free-plan attestation before any request',async()=>{
 const request:typeof fetch=async()=>{throw Error('Network must not be used');};
 await assert.rejects(groqVisualAnswer('',true,'Question',[Buffer.from('image')],request),/Secret/);
 await assert.rejects(groqVisualAnswer('mock',false,'Question',[Buffer.from('image')],request),/Free plan/);
});
test('probe sends only images and neutral question; truncated answers abstain and errors never retry',async()=>{
 let calls=0;
 const request:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://api.groq.com/openai/v1/chat/completions');assert.equal(init?.redirect,'error');const body=JSON.parse(String(init?.body));assert.equal(body.model,GROQ_PROBE_MODEL);assert.equal(body.messages[0].content.at(-1).text,'Count wings');assert.doesNotMatch(String(init?.body),/groundTruth|expected/);return new Response(JSON.stringify({id:'mock-id',model:GROQ_PROBE_MODEL,choices:[{message:{content:'2 wings'},finish_reason:'length'}]}));};
 const answer=await groqVisualAnswer('mock',true,'Count wings',[Buffer.from('image')],request);assert.equal(answer.text,'');assert.equal(calls,1);
 calls=0;await assert.rejects(groqVisualAnswer('mock',true,'Count wings',[Buffer.from('image')],async()=>{calls++;return new Response('not logged',{status:429});}),/HTTP 429/);assert.equal(calls,1);
});
