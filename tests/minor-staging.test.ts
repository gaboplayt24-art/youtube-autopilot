import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {densityReview,mayReviewMinorStaging,applyMinorStagingDecision,inspectMinorStaging,effectiveGroqReview,effectiveGroqReviewStage,existingEffectiveGroqReview,effectiveGeminiReview,effectiveGeminiReviewStage,existingEffectiveGeminiReview} from '../src/visuals/density-qa';
import {Runner} from '../src/orchestration/runner';import {visualReviewEvidence} from '../src/orchestration/production-summary';import {fileDigest} from '../src/orchestration/integrity';import {mediaAsset} from '../src/editor/schemas';
async function poseOnly(){const raw=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));return densityReview.parse({...raw.source02,passed:false,referenceCompared:true,referenceStyleMatches:true,conceptMatches:false,historicallyPlausible:true,cropPreservesSubjects:true,photorealism:false,cgi:false,geometricCodeLook:false,webUILook:false,bakedText:false,watermark:false,adultAnatomyCorrect:true,seriousAnatomyDefects:[],wrongProp:false,majorHistoricalError:false,unreadableOutput:false,issues:['Holding the scroll instead of resting hands by his sides']});}
const decision={supportsNarration:true,allNarratedSubjectsPresent:true,cosmeticStagingOnly:true,factualMismatch:false,historicalError:false,seriousAnatomyError:false,visibleEvidence:'The reader visibly holds an open scroll, supporting the narrated close reading.'};
test('actual-image adjudication receives the planned label and cast but still preserves a rejection',async()=>{
 const idea={id:'messenger',narration:'Gabriel delivers news.',historicalContext:'Interpretive biblical illustration.',concept:'Eli listens to a human-looking white-robed messenger.',characterRoles:['Eli','Gabriel, human-looking messenger'],overlay:'Gabriel the Messenger',overlayAnchor:'delivers news',labelPlacement:'right' as const};
 const rejected={...decision,supportsNarration:false,factualMismatch:true};let calls=0;
 const result=await inspectMinorStaging('assets/references/style-v5-eli.png',idea,await poseOnly(),{images:async<T>(prompt:string,images:{mimeType:string;data:string}[],schema:import('zod').z.ZodType<T>)=>{
  calls++;assert.equal(images.length,1);assert.ok(images[0].data.length>100);
  assert.ok(prompt.includes(JSON.stringify(idea.overlay)));assert.ok(prompt.includes(JSON.stringify(idea.overlayAnchor)));assert.ok(prompt.includes(JSON.stringify(idea.characterRoles)));
  return schema.parse(rejected);
 }});
 assert.equal(calls,1);assert.equal(result.supportsNarration,false);assert.equal(result.factualMismatch,true);
});
test('a planned textual-source shot need not reenact quoted figures, but must show its requested subjects and prop',async()=>{
 const before=await poseOnly(),idea={characterRoles:['Eli'],concept:'Eli consults an open parchment scroll on a stone ledge.',narration:'Here, Jude explicitly addresses Michael with the title of archangel.'};
 const evidence={...decision,allNarratedSubjectsPresent:false,textualSourceIllustrationOnly:true,plannedTextualSubjectsPresent:true};
 assert.equal(applyMinorStagingDecision(before,evidence,idea).passed,true);
 assert.equal(applyMinorStagingDecision(before,{...evidence,plannedTextualSubjectsPresent:false},idea).passed,false);
 assert.equal(applyMinorStagingDecision(before,evidence,{...idea,concept:'Eli stands alone in a street.'}).passed,false);
 assert.equal(applyMinorStagingDecision(before,evidence,{...idea,narration:'A hand touches Daniel on the shoulder.'}).passed,false);
 for(const key of ['factualMismatch','historicalError','seriousAnatomyError'] as const)assert.equal(applyMinorStagingDecision(before,{...evidence,[key]:true},idea).passed,false);
 assert.equal(applyMinorStagingDecision({...before,adultAnatomyCorrect:false},evidence,idea).passed,false);
 assert.equal(before.conceptMatches,false);
});
test('new Gemini adjudication preserves valid legacy decisions and rejected historical evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gemini-staging-version-'));
 try{
  const sourceSha256='a'.repeat(64),referenceSha256='b'.repeat(64),originalReview=await poseOnly(),review=applyMinorStagingDecision(originalReview,decision,{characterRoles:['Eli']});
  const receipt={policy:'gemini-free-owner-minor-v1' as const,provider:'gemini' as const,model:'fixture-gemini',sourceSha256,referenceSha256,review,originalReview,minorStagingStage:'fixture-review'};
  const runner=new Runner(dir),legacy=(id:string)=>'native-'+id+'-effective-gemini-v1-'+sourceSha256.slice(0,12);
  await runner.stage(legacy('accepted'),effectiveGeminiReview,async()=>receipt);
  assert.equal((await existingEffectiveGeminiReview(dir,'accepted',sourceSha256,referenceSha256))!.review.passed,true);
  await runner.stage('native-accepted-v2-effective-gemini-v2-'+sourceSha256.slice(0,12),effectiveGeminiReview,async()=>receipt);
  assert.equal((await existingEffectiveGeminiReview(dir,'accepted-v2',sourceSha256,referenceSha256))!.review.passed,true);
  await runner.stage(legacy('rejected'),effectiveGeminiReview,async()=>({...receipt,review:originalReview}));
  assert.equal(await existingEffectiveGeminiReview(dir,'rejected',sourceSha256,referenceSha256),null);
  await runner.stage(effectiveGeminiReviewStage('rejected',sourceSha256),effectiveGeminiReview,async()=>receipt);
  assert.equal((await existingEffectiveGeminiReview(dir,'rejected',sourceSha256,referenceSha256))!.review.passed,true);
  assert.equal(JSON.parse(await readFile(join(dir,legacy('rejected')+'.json'),'utf8')).review.passed,false);
  await assert.rejects(existingEffectiveGeminiReview(dir,'rejected',sourceSha256,'c'.repeat(64)),/reference mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('owner minor-staging tolerance changes narrative matching only after actual-image adjudication',async()=>{
 const before=await poseOnly();assert.equal(mayReviewMinorStaging(before),true);const after=applyMinorStagingDecision(before,decision,{characterRoles:['Eli']});assert.equal(after.passed,true);assert.equal(before.conceptMatches,false);assert.equal(after.conceptMatches,true);
 const offscreen={...decision,allNarratedSubjectsPresent:false,offscreenInteractionPartnerOnly:true};assert.equal(applyMinorStagingDecision(before,offscreen,{characterRoles:['Eli']}).passed,true);assert.equal(applyMinorStagingDecision(before,{...offscreen,factualMismatch:true},{characterRoles:['Eli']}).passed,false);
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
