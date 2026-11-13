import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {translateClipTitles,shortMetadata} from '../src/social/localize';
const clips=[{id:'A',title:'Who were the Nephilim?',source:'Genesis 6:4'},{id:'C',title:'Why did the scouts call the land evil?',source:'Numbers 13'}];
test('clip titles are translated once, reused while the English title is unchanged, and bound to it',async()=>{
 let calls=0;const llm={json:async<T>(_p:string,s:z.ZodType<T>)=>{calls++;return s.parse({titles:[{id:'A',es:'¿Quiénes eran los nefilim?',ptBR:'Quem eram os nefilins?'},{id:'C',es:'¿Por qué los espías llamaron mala a la tierra?',ptBR:'Por que os espiões chamaram a terra de má?'}]});}} as never;
 const t=await translateClipTitles(llm,clips);assert.equal(calls,1);
 assert.deepEqual(await translateClipTitles(llm,clips,t),t);assert.equal(calls,1);
 const meta=shortMetadata(clips[0],'IhBgX3Nh54s','bible-nephilim-007',t);
 assert.equal(meta.localizations.es.title,'¿Quiénes eran los nefilim? #Shorts');assert.match(meta.localizations['pt-BR'].description,/IhBgX3Nh54s/);assert.doesNotMatch(meta.description,/angel/i);
 assert.throws(()=>shortMetadata({...clips[0],title:'Changed title'},'x','bible-nephilim-007',t),/translations missing/);
 assert.throws(()=>shortMetadata(clips[0],'x','bible-nephilim-007'),/translations missing/);
 assert.match(shortMetadata({id:'A',title:'Would You Recognize an Angel?',source:'Hebrews 13:2'},'x').localizations.es.title,/ángel/);
});
