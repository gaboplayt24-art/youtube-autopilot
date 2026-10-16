import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Runner} from '../src/orchestration/runner';
import {visualReviewEvidence} from '../src/orchestration/production-summary';
import {fileDigest} from '../src/orchestration/integrity';
import {mediaAsset} from '../src/editor/schemas';
import {densityReview,narrativeReview,narrativeReviewStage,existingNarrativeReview} from '../src/visuals/density-qa';
test('re-reviewed artwork evidence remains bound to exact source, reference and unmodified review bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'narrative-review-'));
 try{
  const raw=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));
  const review=densityReview.parse(raw.source02),sha='a'.repeat(64),reference='b'.repeat(64),id='beat-p3';
  const evidence={policy:'narrative-facts-v1' as const,sourceSha256:sha,referenceSha256:reference,review};
  const stage=narrativeReviewStage(id,sha),runner=new Runner(root);
  await runner.stage(stage,narrativeReview,async()=>evidence);
  assert.deepEqual(await existingNarrativeReview(root,id,sha,reference),review);
  assert.equal(await existingNarrativeReview(root,'no-such-source',sha,reference),null);
  await assert.rejects(existingNarrativeReview(root,id,sha,'c'.repeat(64)),/reference mismatch/);
  await assert.rejects(existingNarrativeReview(root,id,sha.slice(0,12)+'c'.repeat(52),reference),/reference mismatch/);
  await writeFile(join(root,stage+'.json'),JSON.stringify({...evidence,review:{...review,passed:!review.passed}}));
  await assert.rejects(existingNarrativeReview(root,id,sha,reference),/Corrupted/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('delivery reports the hash-bound effective image review and retains the original rejection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'delivery-review-'));
 try{
  const path=join(root,'beat-p3.png');await writeFile(path,'unit-test bytes, not generated artwork');const sha=await fileDigest(path),reference='b'.repeat(64);
  const raw=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));
  const original=densityReview.parse({...raw.source02,passed:false}),review=densityReview.parse({...raw.source02,passed:true});
  await writeFile(join(root,'native-beat-p3-density-QA-v4.3.json'),JSON.stringify(original));
  const asset=mediaAsset.parse({shotId:'beat',sourceImageId:'beat',sourceSha256:sha,path,sha256:sha,kind:'image',provider:'unit-test',license:'mock',sourceUrl:null,estimatedCost:0,intent:'mock',fallbacks:[],artwork:{generationMethod:'ai-illustration',styleVersion:'round-head-v5',model:'@cf/black-forest-labs/flux-2-klein-4b',referenceSha256:reference,sourceSha256:sha,referenceQAPassed:true}});
  assert.equal((await visualReviewEvidence(root,[asset]))[0].review.passed,false);
  await new Runner(root).stage(narrativeReviewStage('beat-p3',sha),narrativeReview,async()=>({policy:'narrative-facts-v1',sourceSha256:sha,referenceSha256:reference,review}));
  const delivered=(await visualReviewEvidence(root,[asset]))[0];
  assert.equal(delivered.review.passed,true);assert.equal(delivered.originalReview.passed,false);assert.equal(delivered.sourceSha256,sha);
  await writeFile(path,'changed source');await assert.rejects(visualReviewEvidence(root,[asset]),/source integrity mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
