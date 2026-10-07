import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {qualityScript,createQualityScript,correctHistoricalScript,milestoneScript} from '../src/visuals/quality-script';
const words=['imagined','reconstruction',...Array.from({length:198},(_,i)=>`word${i}`)];
const fixture={title:'A harbor before sunrise',topic:'Imagined Mediterranean story',hook:'A merchant waits at dawn',criticalTerms:[],scenes:Array.from({length:4},(_,i)=>({id:`scene-${i+1}`,narration:words.slice(i*50,(i+1)*50).join(' '),visual:'Ancient harbor scene',claims:[]}))};
test('historical findings cannot be ignored by a passed flag before synthesis',async()=>{
 const provider=(remainingIssues:string[])=>({json:async<T>(instruction:string,schema:z.ZodType<T>)=>{assert.match(instruction,/southern sea/);return schema.parse({script:fixture,passed:true,remainingIssues});}});
 await assert.rejects(correctHistoricalScript(fixture,['southern sea contradicts Alexandria geography'],provider(['unresolved geography'])),/requires review/);
 assert.equal((await correctHistoricalScript(fixture,['southern sea'],provider([]))).passed,true);
});
test('90-second milestone requires a measured-pace word budget without padding audio',()=>{
 assert.throws(()=>milestoneScript.parse(fixture),/required 250-280/);
 const long={...fixture,scenes:fixture.scenes.map((s,i)=>({...s,narration:s.narration+' '+Array.from({length:15},(_,j)=>`added${i}letter${j}`).join(' ')}))};
 assert.equal(milestoneScript.parse(long).scenes.length,4);
});
test('quality story rejects short narration and production jargon before TTS',()=>{
 assert.equal(qualityScript.parse(fixture).scenes.length,4);
 assert.throws(()=>qualityScript.parse({...fixture,scenes:fixture.scenes.map(s=>({...s,narration:s.narration.split(' ').slice(0,25).join(' ')}))}),/required 190-210/);
 assert.throws(()=>qualityScript.parse({...fixture,scenes:fixture.scenes.map((s,i)=>i? s:{...s,narration:s.narration.replace('word0','rendering')})}),/human historical story/);
});
test('quality script gives bounded schema correction feedback without accepting deficient prose',async()=>{
 let calls=0;const prompts:string[]=[];const bad={...fixture,scenes:fixture.scenes.map(s=>({...s,narration:s.narration.split(' ').slice(0,25).join(' ')}))};
 const provider={json:async<T>(instruction:string,schema:z.ZodType<T>)=>{prompts.push(instruction);return schema.parse(++calls===1?bad:fixture);}};
 assert.deepEqual(await createQualityScript(provider),fixture);assert.equal(calls,2);assert.match(prompts[1],/Previous output violated/);
 let failures=0;await assert.rejects(createQualityScript({json:async<T>(_instruction:string,schema:z.ZodType<T>)=>{failures++;return schema.parse(bad);}}),z.ZodError);assert.equal(failures,3);
});
