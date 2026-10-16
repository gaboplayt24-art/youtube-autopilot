import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import {sourceBoundVision,illustratedStyleLock,type ArtworkIdea} from '../src/visuals/illustration-schema';
import {nativePrompt} from '../src/visuals/native-v4-2';
import {regenerationIdea} from '../src/visuals/illustrated-video-assets';
import {editorialRevision,visualRevisionEditStage,applyEditorialRevision} from '../src/visuals/visual-thinking';
import {Runner} from '../src/orchestration/runner';
import {shot,type Shot} from '../src/editor/schemas';
const load=async()=>editorialRevision.parse(JSON.parse(await readFile('data/scripts/bible-angels-001-visual-revisions.json','utf8')));
test('source-bound visionary anatomy requires explicit source context and never exempts ordinary humans',()=>{
 assert.equal(sourceBoundVision({historicalContext:'Ordinary Judean visitors have six fingers'}),'');
 assert.equal(sourceBoundVision({historicalContext:'Source-bound vision, unsupported passage'}),'');
 const both=sourceBoundVision({historicalContext:'Source-bound vision, Isaiah 6:2 and Ezekiel 1:4-21'});
 assert.match(both,/six wings/);assert.match(both,/four faces/);assert.match(both,/Human anatomy applies only to humans/);assert.match(both,/wrong source counts or unintended defects still FAIL/);
});
test('real selective repairs validate within native provider limits and preserve source anatomy during retry',async()=>{
 const revision=await load(),style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v5.json','utf8')));
 assert.ok(revision.sourceRevisions.length>0);assert.equal(new Set(revision.sourceRevisions.map(r=>r.sourceId)).size,revision.sourceRevisions.length);
 for(const r of revision.sourceRevisions){
  assert.notEqual(r.sourceId,r.replacement.id);
  for(const v of ['v1','v2','v3'] as const)assert.ok(nativePrompt(style,r.replacement,v).length<=2048,r.replacement.id);
  if(sourceBoundVision(r.replacement)){
   const prompt=nativePrompt(style,r.replacement,'v3'),retried=regenerationIdea(r.replacement,style),retryPrompt=nativePrompt(style,retried,'v3');
   if(r.replacement.depictionScope==='text-source'){
    for(const value of [prompt,retryPrompt]){assert.match(value,/Source-reading scene only/);assert.match(value,/no visionary beings/);assert.doesNotMatch(value,/only the requested visionary subject/);}
    assert.equal(retried.depictionScope,'text-source');assert.match(retried.concept,/manuscript/);assert.doesNotMatch(retried.concept,/Preserve the source-described visionary anatomy/);
   }else{assert.match(prompt,/SOURCE VISION/);assert.doesNotMatch(prompt,/No people or characters/);assert.doesNotMatch(retried.concept,/empty scene|nobody else/);}
   assert.ok(retryPrompt.length<=2048);
  }
 }
 // Source count corrections do not change the approved medium, model or reference.
 assert.equal(style.version,'round-head-v5');assert.match(nativePrompt(style,revision.sourceRevisions[0].replacement,'v3'),/input_image_0/);
});
test('resuming after a visual revision cannot resurrect the previous source plan or alter narration timing',async()=>{
 const revision=await load(),r=revision.sourceRevisions[0];
 const originalIdea:ArtworkIdea={...r.replacement,id:r.sourceId,concept:'Original scene retained only as rejected evidence'};
 const original=shot.parse({id:r.sourceId,sceneId:'chapter-1',start:1,end:5,narration:r.replacement.narration,visualIntent:originalIdea.concept,shotType:'generated-image',motion:'slow-push-in',assetPrompt:originalIdea.concept,illustrationIdea:originalIdea,overlay:null,keywords:[],highImpact:false,transition:'cut'});
 const revised=applyEditorialRevision([original],{...revision,sourceRevisions:[r]},revision.runId);
 assert.deepEqual(revised.map(s=>[s.narration,s.start,s.end]),[[original.narration,1,5]]);assert.equal(revised[0].visualIntent,r.replacement.concept);
 const dir=await mkdtemp(join(tmpdir(),'visual-revision-'));
 try{
  const runner=new Runner(dir),schema=z.object({shots:z.array(shot)}),old={shots:[original]},fresh={shots:revised};
  await runner.stage(visualRevisionEditStage(old,false),schema,async()=>old);
  const key=visualRevisionEditStage(fresh,true);
  const result=await runner.stage(key,schema,async()=>fresh);
  assert.equal(result.shots[0].assetKey,r.replacement.id);
  assert.deepEqual(await runner.stage(key,schema,async()=>{throw Error('Must resume verified corrected plan');}),result);
  assert.notEqual(visualRevisionEditStage({shots:[{...revised[0],assetKey:'another-correction'} as Shot]},true),key);
 }finally{await rm(dir,{recursive:true,force:true});}
});
