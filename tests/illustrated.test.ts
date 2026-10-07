import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {loadStyleLock,lockedPrompt} from '../src/visuals/style-lock';
import {storyboard,validateStoryboard,sourceUsage,planIllustratedBeats} from '../src/visuals/illustrated';
import {createCharacterReferencePack} from '../src/visuals/characters-v2';
import {exec} from '../src/orchestration/io';
import type {Shot} from '../src/editor/schemas';
import type {LLMProvider,VisionProvider} from '../src/providers/interfaces';
const shots=Array.from({length:32},(_,i)=>({id:'shot-'+i,sceneId:'scene-1',start:i*3,end:(i+1)*3,narration:'A specific narrated action',visualIntent:'Specific subject',shotType:'generated-image',motion:'parallax',assetPrompt:'Specific subject and action',overlay:null,keywords:[],highImpact:false,transition:'cut'} as Shot));
function board(){return storyboard.parse({sources:Array.from({length:28},(_,i)=>({id:'source-'+i,concept:'Specific period subject '+i,character:i===1,momentId:'moment-'+i})),beats:shots.map((s,i)=>({shotId:s.id,sourceImageId:'source-'+(i<28?i:[0,3,7,12][i-28]),editorialVariant:i<28?'wide':'detail-left',reuseReason:[0,3,7,12,28,29,30,31].includes(i)?'Same exact narrated visual moment, closer object detail':null})),thumbnailTexts:['Dawn Cargo','Bronze Weights','Market Day']});}
test('batched keyframe schema correction preserves all 30 narration beat IDs and never forces reuse',async()=>{
 const audition=shots.slice(0,30),instructions:string[]=[];let batches=0;
 const llm:LLMProvider={json:async<T>(p:string,s:z.ZodType<T>)=>{
  instructions.push(p);const batch=audition.slice(batches*8,batches*8+8);
  const keyframes=batch.map(shot=>({shotId:shot.id,concept:'35mm specific period action '+shot.id,character:false}));
  if(instructions.length===1)return s.parse({keyframes:keyframes.map((k,i)=>i===0?{...k,character:'invalid'}:k)});
  batches++;return s.parse({keyframes});
 }};
 const result=await planIllustratedBeats(audition,{},await loadStyleLock(),llm);
 assert.equal(instructions.length,5);assert.match(instructions[1],/Fix schema\/ID rejection/);
 assert.equal(result.sources.length,30);assert.equal(result.beats.length,30);assert.deepEqual(result.beats.map(b=>b.shotId),audition.map(s=>s.id));assert.equal(new Set(result.beats.map(b=>b.sourceImageId)).size,30);
});
test('28 generated sources produce 32 beats without counting reframes as new sources',async()=>{
 const lock=await loadStyleLock(),b=validateStoryboard(board(),shots,lock);const q=sourceUsage(b.beats,shots,Object.fromEntries(b.sources.map(s=>[s.id,s.id])),lock);assert.equal(q.uniqueSourceRatio,.875);assert.equal(q.uniqueGeneratedSources,28);assert.equal(q.consecutiveDuplicateSources,0);assert.equal(Math.max(...Object.values(q.sourceReuseCounts)),2);assert.deepEqual(q.issues,[]);
});
test('consecutive reuse and unjustified fake framing diversity are blocked',async()=>{
 const lock=await loadStyleLock();let b=board();b.beats[1].sourceImageId=b.beats[0].sourceImageId;assert.throws(()=>validateStoryboard(b,shots,lock),/Consecutive/);
 b=board();b.beats[28].editorialVariant='wide';assert.throws(()=>validateStoryboard(b,shots,lock),/materially different/);
 b=board();b.beats[28].reuseReason=null;assert.throws(()=>validateStoryboard(b,shots,lock),/Reuse needs/);
});
test('different IDs with identical source bytes cannot inflate unique source ratio',async()=>{
 const lock=await loadStyleLock(),b=board();const q=sourceUsage(b.beats,shots,Object.fromEntries(b.sources.map(s=>[s.id,'identical-sha'])),lock);assert.equal(q.uniqueGeneratedSources,1);assert.equal(q.consecutiveDuplicateSources,31);assert.ok(q.issues.includes('Source used more than twice'));assert.ok(q.issues.includes('Unique source ratio below .75'));
});
test('source contact sheet order follows first narration appearance rather than model array order',async()=>{
 const b=board();b.sources.reverse();const ordered=validateStoryboard(b,shots,await loadStyleLock());assert.equal(ordered.sources[0].id,'source-0');assert.equal(ordered.sources.at(-1)!.id,'source-27');assert.equal(b.sources[0].id,'source-27');
});
test('every frame and reference inherits exact prefix and all negatives without truncation',async()=>{
 const lock=await loadStyleLock();
 const bible={era:'30 BCE',century:'1st century BCE',civilization:'Ptolemaic Egypt',location:'Alexandria',regionalArchitecture:'limestone',materials:'clay linen bronze',clothing:'linen chiton',boats:'wooden boats',technology:'papyrus',forbiddenAnachronisms:['plastic','electricity','cars']} as Parameters<typeof lockedPrompt>[1];
 for(const identity of [undefined,'olive-skinned merchant with single black braid']){const prompt=lockedPrompt(lock,bible,'35mm merchant weighing grain',identity);assert.ok(prompt.startsWith(lock.prefix));for(const rule of lock.negativeRules)assert.ok(prompt.includes(rule));assert.ok(prompt.includes('30 BCE'));}
 assert.throws(()=>lockedPrompt(lock,bible,'x'.repeat(2048)),/exceeds/);
});
test('canonical QA regenerates only drifted view and resumes its repaired checkpoint',async()=>{
 const root=await mkdtemp(join(tmpdir(),'canonical-v2-'));try{
  const assets=join(root,'assets'),bible={era:'30 BCE',century:'1st century BCE',civilization:'Ptolemaic Egypt',location:'Alexandria',regionalArchitecture:'limestone',materials:'clay linen bronze',clothing:'linen',boats:'wood',technology:'papyrus',forbiddenAnachronisms:['plastic','cars','power']} as Parameters<typeof lockedPrompt>[1];
  const calls:Record<string,number>={};const image={generate:async(prompt:string,path:string)=>{assert.ok(prompt.startsWith((await loadStyleLock()).prefix));const id=path.split('/').at(-3)!;calls[id]=(calls[id]??0)+1;await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=64x64','-frames:v','1',path]);}};
  let reviewCalls=0;const llm:LLMProvider&VisionProvider={json:async<T>(_p:string,schema:z.ZodType<T>)=>schema.parse({passed:true,issues:[]}),images:async<T>(_p:string,_i:unknown,schema:z.ZodType<T>)=>{reviewCalls++;return schema.parse({passed:reviewCalls>1,samePerson:reviewCalls>1,sameAge:true,sameHairstyle:true,sameFacialStructure:reviewCalls>1,sameCostume:true,sameBodyProportions:true,outliers:reviewCalls===1?[{id:'B',reason:'Different jaw',repairDirection:'Match the front reference oval jaw'}]:[],review:'actual fixture review'});}};
  const character={id:'merchant',identity:'oval olive face, black braid, brown eyes',costume:'ochre linen chiton',props:[],era:'30 BCE',continuityRules:['same person']};
  const pack=await createCharacterReferencePack(character,bible,assets,image,llm);assert.equal(pack.assets.length,5);assert.equal(pack.hiddenReferences,true);assert.equal(pack.qaPassed,true);assert.deepEqual(calls,{A:1,B:2,C:1,D:1,E:1});
  await createCharacterReferencePack(character,bible,assets,image,llm);assert.deepEqual(calls,{A:1,B:2,C:1,D:1,E:1});
 }finally{await rm(root,{recursive:true,force:true});}
});
