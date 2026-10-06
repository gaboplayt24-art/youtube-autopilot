import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alignWords,alignWithASRFallback} from '../src/providers/kokoro';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {exec} from '../src/orchestration/io';
import {narrateChapters} from '../src/voice/chapters';
test('more accurate ASR resolves merged words using actual replacement timestamps',async()=>{
 const models:string[]=[];
 const result=await alignWithASRFallback('stone walls',async model=>{models.push(model);return {chunks:model.endsWith('tiny.en')?[{text:'stonewalls',timestamp:[1,2]}]:[{text:'stone',timestamp:[1,1.4]},{text:'walls',timestamp:[1.4,2]}]};});
 assert.deepEqual(models,['Xenova/whisper-tiny.en','Xenova/whisper-base.en']);
 assert.deepEqual(result,[{text:'stone',start:1,end:1.4},{text:'walls',start:1.4,end:2}]);
});
test('ASR retry fails closed when speech differs, preserving the exact-match gate',async()=>{
 let attempts=0;
 await assert.rejects(alignWithASRFallback('stone walls',async()=>{attempts++;return {chunks:[{text:'modern',timestamp:[1,1.4]},{text:'walls',timestamp:[1.4,2]}]};}),/differs from script/);
 assert.equal(attempts,2);
 await assert.rejects(alignWithASRFallback('stone',async()=>({chunks:[{text:'stone',timestamp:[1,null]}]})),/missing timestamp/);
});
test('zero-width ASR tokens form a measured short phrase without fabricated per-word times',()=>{
 assert.deepEqual(alignWords('a journey,',[{text:'a',timestamp:[28.44,28.44]},{text:'journey',timestamp:[28.44,28.7]}]),[{text:'a journey,',start:28.44,end:28.7}]);
 assert.throws(()=>alignWords('a',[{text:'a',timestamp:[1,1]}]),/missing timestamp/);
});
test('audio-first scene cuts consume phrase tokens and reject a cut inside a measured phrase',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'phrase-cuts-'));
 try{const source=join(dir,'source.wav');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','sine=frequency=200:duration=3','-ar','48000',source]);
 const words=[{text:'a journey',start:0,end:1},{text:'begins',start:1,end:1.5},{text:'ordinary',start:1.5,end:2},{text:'lives',start:2,end:3}];const tts={speak:async(_text:string,path:string)=>{await copyFile(source,path);return {alignment:words,words};}};
 const result=await narrateChapters({scenes:[{id:'s1',narration:'a journey begins',visual:'harbor'},{id:'s2',narration:'ordinary lives',visual:'market'}]},tts,dir);
 assert.equal(result.scenes[0].duration,1.5);assert.equal(result.scenes[1].duration,1.5);assert.equal(result.scenes[0].alignment.map(w=>w.text).join(' '),'a journey begins');
 await assert.rejects(narrateChapters({scenes:[{id:'s1',narration:'a',visual:'harbor'},{id:'s2',narration:'journey begins ordinary lives',visual:'market'}]},tts,dir),/crosses scene boundary/);
 }finally{await rm(dir,{recursive:true});}
});
