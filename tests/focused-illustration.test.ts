import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {illustratedStyleLock,sourceBoundVision,type ArtworkIdea} from '../src/visuals/illustration-schema';
import {nativePrompt,VisualStyleEngine,nativeIllustration,nativeSource} from '../src/visuals/native-v4-2';
import {fileDigest} from '../src/orchestration/integrity';
import {createIllustratedVideoAssets} from '../src/visuals/illustrated-video-assets';
import {densityReview} from '../src/visuals/density-qa';
import {shot} from '../src/editor/schemas';
import {Runner} from '../src/orchestration/runner';
const style=async()=>illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v5.json','utf8')));
const idea:ArtworkIdea={id:'wing-study',narration:'Isaiah describes six wings in three pairs.',historicalContext:'Source-bound vision, Isaiah 6:2, eighth-century BCE Judah.',concept:'Three separate pairs of illustrated feathered wings, six wings total, in a clear ink study on a cream field. No complete body.',characterRoles:['None'],overlay:'Three pairs',labelPlacement:'top',promptFocus:true,depictionScope:'wing-study'};
test('an altered owned layout reference stops before any inference or asset spending',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'layout-reference-')),s=await style(),runner=new Runner(dir);let calls=0;
 try{
  const path='tests/fixtures/wing-count/six.png',sha256=await fileDigest(path),stage='native-fixture-guide-source';
  await runner.stage(stage,nativeSource,async()=>({path,sha256,model:'@cf/black-forest-labs/flux-2-klein-4b' as const,width:512,height:288,aspectRatio:'16:9' as const,prompt:'Mock test guide; not a production inference receipt',referenceSha256:s.referenceSha256!}));
  const provider={json:async<T>():Promise<T>=>{calls++;throw Error('Inference must not happen');},images:async<T>():Promise<T>=>{calls++;throw Error('Inference must not happen');}};
  await assert.rejects(new VisualStyleEngine().generate({...idea,layoutReference:{stage,sha256:'a'.repeat(64)}},s,'assets/references/style-v5-eli.png',dir,runner,provider),/layout reference integrity mismatch/);
  assert.equal(calls,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('focused directions retain the locked prefix and distinguish complete beings from explicitly scoped studies',async()=>{
 const s=await style(),prompt=nativePrompt(s,idea,'v3');
 assert.ok(prompt.startsWith(s.prefix));assert.ok(prompt.length<=2048);assert.match(prompt,/drawing medium ONLY/);assert.match(prompt,/three separate PAIRS/);assert.doesNotMatch(prompt,/wrong source counts or unintended defects still FAIL|bronze or iron hand tools/);
 const complete=sourceBoundVision({...idea,depictionScope:'whole-scene'});assert.match(complete,/six wings, two cover face/);
 const detail=sourceBoundVision({...idea,depictionScope:'wing-pair-detail'});assert.match(detail,/ONE specified wing pair/);assert.match(detail,/never approve a complete two-winged body/);
 const faces=sourceBoundVision({historicalContext:'Source-bound vision, Ezekiel 1:4-21',depictionScope:'face-study'});assert.match(faces,/four separate face-type portraits/);assert.match(faces,/ONE creature/);
 const wheel=sourceBoundVision({historicalContext:'Source-bound vision, Ezekiel 1:4-21',depictionScope:'wheel-detail'});assert.match(wheel,/eyes on the rim only/);assert.doesNotMatch(wheel,/each creature four faces/);
});
test('a blocked production beat stops after one bounded regeneration without spending on later beats',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'image-fail-fast-')),s=await style(),original=VisualStyleEngine.prototype.generate,calls:string[]=[];
 const fixture=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));
 const review=densityReview.parse({...fixture.source02,passed:false,objectiveFailures:['requiredConcept'],issues:['Wrong source wing count'],seriousAnatomyDefects:[]});
 VisualStyleEngine.prototype.generate=async i=>{calls.push(i.id);return nativeIllustration.parse({ideaId:i.id,source:{path:'unused.png',sha256:'a'.repeat(64),referenceSha256:s.referenceSha256,model:'@cf/black-forest-labs/flux-2-klein-4b',width:2048,height:1152,aspectRatio:'16:9',prompt:'mock only'},review,artwork:null});};
 try{
  const shots=['first','second'].map((id,i)=>shot.parse({id,sceneId:'chapter',start:i*4,end:i*4+4,narration:idea.narration,visualIntent:idea.concept,shotType:'generated-image',motion:'slow-push-in',assetPrompt:idea.concept,illustrationIdea:{...idea,id},overlay:null,keywords:[],highImpact:false,transition:'cut'}));
  const unavailable={json:async()=>{throw Error('No real LLM expected');},images:async()=>{throw Error('No real vision expected');}};
  await assert.rejects(createIllustratedVideoAssets(shots,s,'unused-reference.png',dir,new Runner(dir),unavailable),/Native production illustration QA failed: first/);
  assert.deepEqual(calls,['first','first-regen1']);
 }finally{VisualStyleEngine.prototype.generate=original;await rm(dir,{recursive:true,force:true});}
});
