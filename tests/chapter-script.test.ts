import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterScriptContract} from '../src/script';
import {performance} from '../src/longform';
const text=Array(35).fill('word').join(' ');
const value={title:'Original sourced title',topic:'Biblical narratives',hook:'An original question',scenes:[0,1].map(i=>({id:'scene-'+i,narration:text,visual:'Original illustration',claims:[{text:'A sourced assertion '+i,sourceUrl:'https://example.org/source',kind:'fact'}]}))};
test('missing non-factual performance lists mean no added instructions, while timing and tone remain validated',()=>{
 const p=performance.parse({tone:'calm',pace:'normal',pauseAfterMs:0,emotion:'curious',energy:.4});
 assert.deepEqual(p.emphasis,[]);assert.deepEqual(p.pronunciation,[]);
 assert.throws(()=>performance.parse({tone:'calm',pace:'unknown',pauseAfterMs:0,emotion:'curious',energy:2}));
});
test('chapter contract rejects length drift, missing narrative blocks and repetition without weakening claims',()=>{
 assert.ok(chapterScriptContract(70,'HOOK').safeParse(value).success);
 assert.equal(chapterScriptContract(200,'HOOK').safeParse(value).success,false);
 assert.equal(chapterScriptContract(70,'HOOK').safeParse({...value,scenes:[value.scenes[0]]}).success,false);
 assert.equal(chapterScriptContract(70,'ACT 2',value.scenes.flatMap(s=>s.claims.map(c=>c.text))).safeParse(value).success,false);
 assert.equal(chapterScriptContract(70,'HOOK').safeParse({...value,scenes:value.scenes.map(s=>({...s,claims:[{text:'Unsupported',kind:'fact'}]}))}).success,false);
});
