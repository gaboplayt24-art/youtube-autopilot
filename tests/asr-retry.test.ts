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
 const result=await alignWithASRFallback('stone walls',async model=>{models.push(model);return {chunks:model.endsWith('tiny.en')?[{text:'stone',timestamp:[1,1.4]},{text:'doors',timestamp:[1.4,2]}]:[{text:'stone',timestamp:[1,1.4]},{text:'walls',timestamp:[1.4,2]}]};});
 assert.deepEqual(models,['Xenova/whisper-tiny.en','Xenova/whisper-base.en']);
 assert.deepEqual(result,[{text:'stone',start:1,end:1.4},{text:'walls',start:1.4,end:2}]);
});
test('ASR retry fails closed when WER/critical gates reject speech, preserving evidence',async()=>{
 let attempts=0;
 await assert.rejects(alignWithASRFallback('stone walls',async()=>{attempts++;return {chunks:[{text:'modern',timestamp:[1,1.4]},{text:'walls',timestamp:[1.4,2]}]};}),/Voice QA FAIL/);
 assert.equal(attempts,3);
 await assert.rejects(alignWithASRFallback('stone',async()=>({chunks:[{text:'stone',timestamp:[1,null]}]})),/missing timestamp/);
});
test('zero-width ASR tokens form a measured short phrase without fabricated per-word times',()=>{
 assert.deepEqual(alignWords('a journey,',[{text:'a',timestamp:[28.44,28.44]},{text:'journey',timestamp:[28.44,28.7]}]),[{text:'a journey,',start:28.44,end:28.7}]);
 assert.throws(()=>alignWords('a',[{text:'a',timestamp:[1,1]}]),/missing timestamp/);
});
test('spacing and hyphen tokenization use whole measured intervals; changed words still fail',()=>{
 assert.deepEqual(alignWords('stone walls',[{text:'stonewalls',timestamp:[1,2]}]),[{text:'stone walls',start:1,end:2}]);
 assert.deepEqual(alignWords('sea-side harbor',[{text:'sea',timestamp:[1,1.2]},{text:'side',timestamp:[1.2,1.5]},{text:'harbor',timestamp:[1.5,2]}]),[{text:'sea-side',start:1,end:1.5},{text:'harbor',start:1.5,end:2}]);
 assert.throws(()=>alignWords('falloff',[{text:'fall',timestamp:[1,2]}]),/differs from script/);
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

test('Small English resolves weak recognizers with measured timestamps; it never changes missing words',async()=>{
 const models:string[]=[];const result=await alignWithASRFallback('salt spray stings',async model=>{models.push(model);return {chunks:model.endsWith('small.en')?[{text:'salt',timestamp:[.1,.3]},{text:'spray',timestamp:[.3,.6]},{text:'stings',timestamp:[.6,.9]}]:[{text:'salt',timestamp:[.1,.3]},{text:'spray',timestamp:[.3,.6]},{text:'stinks',timestamp:[.6,.9]}]};});assert.equal(models.length,3);assert.deepEqual(result.at(-1),{text:'stings',start:.6,end:.9});
 await assert.rejects(alignWithASRFallback('salt spray stings',async()=>({chunks:[{text:'salt spray',timestamp:[.1,.6]}]})),/Voice QA FAIL/);
});

test('new critical terms invalidate cached alignment without accepting an older weaker QA contract',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-critical-cache-'));
 try{const source=join(dir,'source.wav');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','sine=frequency=200:duration=1','-ar','48000',source]);
  let calls=0;const words=[{text:'seraphim',start:0,end:1}];const tts={speak:async(_text:string,path:string,context?:{criticalTerms?:string[]})=>{calls++;if(calls===2)assert.deepEqual(context?.criticalTerms,['seraphim']);await copyFile(source,path);return {alignment:words,words};}};
  const plan={scenes:[{id:'s1',narration:'seraphim',visual:'Source-attributed illustration'}]};
  await narrateChapters(plan,tts,dir);await narrateChapters(plan,tts,dir);assert.equal(calls,1);
  await narrateChapters(plan,tts,dir,140,'demo',{},['seraphim']);assert.equal(calls,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
