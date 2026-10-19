import {test} from 'node:test';
import type {z} from 'zod';
import assert from 'node:assert/strict';
import {LongFormPlanner} from '../src/longform';
import type {LLMProvider} from '../src/providers/interfaces';
const planner=new LongFormPlanner();
const base=planner.plan(600,140,'quality_test','quality_test','Biblical literary descriptions');
const valid={...base,chapters:base.chapters.map((c,i)=>({...c,factsToReveal:['Distinct sourced fact '+i]}))};
test('chapter outline repairs a bare array into the required object without inventing budgets',async()=>{
 let calls=0;const llm:LLMProvider={json:async<T>(prompt:string,schema:z.ZodType<T>)=>{calls++;if(calls===2)assert.match(prompt,/Previous output failed schema validation/);return schema.parse(calls===1?valid.chapters:valid) as T;}};
 const result=await planner.outline(base,{sources:['actual source context']},llm);
 assert.equal(calls,2);assert.equal(result.targetWords,1400);assert.equal(result.targetSeconds,600);
 assert.deepEqual(result.chapters.map(c=>c.targetWords),base.chapters.map(c=>c.targetWords));
});
test('outline repair does not permit changing the approved duration or repeating chapter facts',async()=>{
 const llm=(value:unknown):LLMProvider=>({json:async<T>(_prompt:string,schema:z.ZodType<T>)=>schema.parse(value) as T});
 await assert.rejects(planner.outline(base,{},llm({...valid,targetSeconds:1200})),/changed approved duration/);
 await assert.rejects(planner.outline(base,{},llm({...valid,chapters:valid.chapters.map(c=>({...c,factsToReveal:['Repeated claim']}))})),/no new evidence/);
});
test('long-form resumes validated chapters after a later provider failure instead of regenerating them',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {Runner}=await import('../src/orchestration/runner');const {writeLongForm}=await import('../src/script');
 const dir=await mkdtemp(join(tmpdir(),'chapter-checkpoints-'));const calls=new Map<string,number>();let unavailable=true;
 const llm:LLMProvider={json:async<T>(prompt:string,schema:z.ZodType<T>)=>{
  const chapter=JSON.parse(prompt.split('Chapter plan: ')[1].split('. Already covered facts: ')[0]);calls.set(chapter.id,(calls.get(chapter.id)??0)+1);
  if(chapter.act==='ACT 2'&&unavailable)throw Error('Temporary provider failure');
  const tokens=Array.from({length:chapter.targetWords},(_,i)=>chapter.id+'detail'+i),half=Math.ceil(tokens.length/2);
  const narration=[tokens.slice(0,half).join(' ')+'.',tokens.slice(half).join(' ')+'.'];
  return schema.parse({title:'Original sourced title',topic:'A source-grounded topic',hook:narration[0],scenes:narration.map((n,i)=>({id:chapter.id+'-block-'+i,narration:n,visual:'An original illustration',claims:[{text:'Distinct supported statement '+chapter.id,sourceUrl:'https://example.org/source',kind:'fact'}]}))});
 }};
 try{
  await assert.rejects(()=>writeLongForm({},llm,base,new Runner(dir)),/Temporary provider/);
  unavailable=false;const result=await writeLongForm({},llm,base,new Runner(dir));
  assert.equal(result.scenes.length,6);assert.equal(calls.get('chapter-1'),1);assert.equal(calls.get('chapter-2'),1);assert.equal(calls.get('chapter-3'),2);
  const count=[...calls.values()].reduce((a,b)=>a+b,0);await writeLongForm({},llm,base,new Runner(dir));assert.equal([...calls.values()].reduce((a,b)=>a+b,0),count);
 }finally{await rm(dir,{recursive:true,force:true});}
});
