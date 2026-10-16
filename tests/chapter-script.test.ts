import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterScriptContract,writeChapter} from '../src/script';
import {performance} from '../src/longform';
const text=Array(35).fill('word').join(' ');
const value={title:'Original sourced title',topic:'Biblical narratives',hook:'word word',scenes:[0,1].map(i=>({id:'scene-'+i,narration:text,visual:'Original illustration',claims:[{text:'A sourced assertion '+i,sourceUrl:'https://example.org/source',kind:'fact'}]}))};
test('missing non-factual performance lists mean no added instructions, while timing and tone remain validated',()=>{
 const p=performance.parse({tone:'calm',pace:'normal',pauseAfterMs:0,emotion:'curious',energy:.4});
 assert.deepEqual(p.emphasis,[]);assert.deepEqual(p.pronunciation,[]);
 assert.throws(()=>performance.parse({tone:'calm',pace:'unknown',pauseAfterMs:0,emotion:'curious',energy:2}));
});
test('chapter contract rejects length drift, missing narrative blocks and repetition without weakening claims',()=>{
 assert.ok(chapterScriptContract(70,'HOOK').safeParse(value).success);
 assert.equal(chapterScriptContract(70,'HOOK').safeParse({...value,hook:'A question never actually spoken'}).success,false);
 assert.equal(chapterScriptContract(200,'HOOK').safeParse(value).success,false);
 assert.equal(chapterScriptContract(70,'HOOK').safeParse({...value,scenes:[value.scenes[0]]}).success,false);
 assert.equal(chapterScriptContract(70,'ACT 2',value.scenes.flatMap(s=>s.claims.map(c=>c.text))).safeParse(value).success,false);
 assert.equal(chapterScriptContract(70,'HOOK').safeParse({...value,scenes:value.scenes.map(s=>({...s,claims:[{text:'Unsupported',kind:'fact'}]}))}).success,false);
});

test('chapter revision includes the actual overlong narration and enforces the original total budget',async()=>{
 const overlong={...value,scenes:value.scenes.map(s=>({...s,narration:Array(48).fill('word').join(' ')}))};let calls=0;
 const result=await writeChapter({json:async<T>(prompt:string,schema:import('zod').z.ZodType<T>)=>{
  calls++;if(calls===2){assert.match(prompt,/REVISE THIS ACTUAL REJECTED CHAPTER/);assert.match(prompt,/currently totals 96 words/);assert.match(prompt,/70 words TOTAL, not per block/);assert.ok(prompt.includes(overlong.scenes[0].narration));assert.ok(prompt.includes(overlong.scenes[0].claims[0].sourceUrl));}
  return schema.parse(calls===1?overlong:value);
 }},'Write a sourced hook',70,'HOOK');
 assert.equal(calls,2);assert.equal(result.scenes.length,2);
 calls=0;await assert.rejects(writeChapter({json:async<T>(_p:string,s:import('zod').z.ZodType<T>)=>{calls++;return s.parse(overlong);}},'Write',70,'HOOK'),/approved target 70/);assert.equal(calls,3);
});

test('later chapters revise a repeated spoken opening rather than disabling full-script repetition QA',async()=>{
 const prior='Why do biblical angels sometimes look like visitors and sometimes appear with six wings?';
 const repeated={...value,hook:prior,scenes:[{...value.scenes[0],narration:prior+' '+Array(20).fill('word').join(' ')},value.scenes[1]]};
 assert.equal(chapterScriptContract(70,'ACT 1',[],[prior]).safeParse(repeated).success,false);
 const fresh={...value,scenes:value.scenes.map((s,i)=>({...s,narration:Array.from({length:35},(_,j)=>'detail'+(i*35+j)).join(' ')}))};
 let calls=0;const revised=await writeChapter({json:async<T>(prompt:string,schema:import('zod').z.ZodType<T>)=>{
  calls++;if(calls===2)assert.match(prompt,/Chapter repeats earlier narration/);
  return schema.parse(calls===1?repeated:fresh);
 }},'Write the next chapter',70,'ACT 1',[],[prior]);
 assert.equal(calls,2);assert.ok(!revised.scenes[0].narration.includes(prior));
});
