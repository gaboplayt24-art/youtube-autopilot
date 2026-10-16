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
