import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {densityReview,mayReviewMinorStaging,applyMinorStagingDecision,effectiveGroqReview,effectiveGroqReviewStage,existingEffectiveGroqReview} from '../src/visuals/density-qa';
import {Runner} from '../src/orchestration/runner';import {visualReviewEvidence} from '../src/orchestration/production-summary';import {fileDigest} from '../src/orchestration/integrity';import {mediaAsset} from '../src/editor/schemas';
async function poseOnly(){const raw=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));return densityReview.parse({...raw.source02,passed:false,referenceCompared:true,referenceStyleMatches:true,conceptMatches:false,historicallyPlausible:true,cropPreservesSubjects:true,photorealism:false,cgi:false,geometricCodeLook:false,webUILook:false,bakedText:false,watermark:false,adultAnatomyCorrect:true,seriousAnatomyDefects:[],wrongProp:false,majorHistoricalError:false,unreadableOutput:false,issues:['Holding the scroll instead of resting hands by his sides']});}
const decision={supportsNarration:true,allNarratedSubjectsPresent:true,cosmeticStagingOnly:true,factualMismatch:false,historicalError:false,seriousAnatomyError:false,visibleEvidence:'The reader visibly holds an open scroll, supporting the narrated close reading.'};
test('owner minor-staging tolerance changes narrative matching only after actual-image adjudication',async()=>{
 const before=await poseOnly();assert.equal(mayReviewMinorStaging(before),true);const after=applyMinorStagingDecision(before,decision,{characterRoles:['Eli']});assert.equal(after.passed,true);assert.equal(before.conceptMatches,false);assert.equal(after.conceptMatches,true);
 for(const key of ['factualMismatch','historicalError','seriousAnatomyError'] as const)assert.equal(applyMinorStagingDecision(before,{...decision,[key]:true},{characterRoles:['Eli']}).passed,false);
 for(const key of ['supportsNarration','allNarratedSubjectsPresent','cosmeticStagingOnly'] as const)assert.equal(applyMinorStagingDecision(before,{...decision,[key]:false},{characterRoles:['Eli']}).passed,false);
 for(const invalid of [{historicallyPlausible:false},{adultAnatomyCorrect:false},{wrongProp:true},{watermark:true},{cropPreservesSubjects:false}])assert.equal(mayReviewMinorStaging({...before,...invalid}),false);
});
test('effective Groq export preserves the rejected assessment and binds acceptance to exact source bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'groq-effective-'));try{
  const path=join(dir,'beat-p3.png');await writeFile(path,'unit-test bytes, not illustration evidence');const sha=await fileDigest(path),ref='b'.repeat(64),originalReview=await poseOnly(),review=applyMinorStagingDecision(originalReview,decision,{characterRoles:['Eli']});
  const stage=effectiveGroqReviewStage('beat-p3',sha);await new Runner(dir).stage(stage,effectiveGroqReview,async()=>({policy:'groq-free-owner-minor-v1' as const,provider:'groq' as const,model:'qwen/qwen3.8-27b' as const,sourceSha256:sha,referenceSha256:ref,review,originalReview,minorStagingStage:'actual-source-adjudication'}));
  const asset=mediaAsset.parse({shotId:'beat',sourceImageId:'beat',sourceSha256:sha,path,sha256:sha,kind:'image',provider:'unit-test',license:'mock',sourceUrl:null,estimatedCost:0,intent:'mock',fallbacks:[],artwork:{generationMethod:'ai-illustration',styleVersion:'round-head-v5',model:'@cf/black-forest-labs/flux-2-klein-4b',referenceSha256:ref,sourceSha256:sha,referenceQAPassed:true}});
  const exported=(await visualReviewEvidence(dir,[asset]))[0];assert.equal(exported.review.passed,true);assert.equal(exported.originalReview!.passed,false);assert.equal(exported.reviewPolicy,'groq-free-owner-minor-v1');
  await assert.rejects(existingEffectiveGroqReview(dir,'beat-p3',sha,'c'.repeat(64)),/reference mismatch/);
  await writeFile(path,'changed source');await assert.rejects(visualReviewEvidence(dir,[asset]),/integrity mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
