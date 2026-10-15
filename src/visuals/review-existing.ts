/** Actual Gemini re-review of existing source bytes; no image generator, TTS, render or publisher calls. */
import {join} from 'node:path';
import {z} from 'zod';
import {read,json} from '../orchestration/io';
import {Runner} from '../orchestration/runner';
import {fileDigest} from '../orchestration/integrity';
import {GeminiProvider} from '../providers/free';
import {FreeQuotaLedger,withQuota} from '../quota';
import {CostLedger,withCosts,loadCostPolicy} from '../cost';
import {shotPlan} from '../editor/schemas';
import {illustratedStyleLock} from './illustration-schema';
import {applyEditorialRevision,editorialRevision} from './visual-thinking';
import {nativeSource} from './native-v4-2';
import {reviewDensity,narrativeReview,narrativeReviewStage,existingNarrativeReview} from './density-qa';
import {illustrationContactSheet} from './style-contact-sheet-v4';
const runId=z.string().regex(/^[A-Za-z0-9_-]+$/).parse(process.env.RUN_ID);
const root=join('data/runs',runId),reference='assets/references/style-v5-eli.png';
const style=illustratedStyleLock.parse(await read('config/style-lock-v5.json'));
const referenceSha256=await fileDigest(reference);
if(referenceSha256!==style.referenceSha256)throw new Error('Reference identity mismatch');
const plan=shotPlan.parse(await read(join(root,'visual-thinking-v5.json')));
const revision=editorialRevision.parse(await read(join('data/scripts',runId+'-visual-revisions.json')));
const shots=applyEditorialRevision(plan.shots,revision,runId);
const runner=new Runner(root),quota=new FreeQuotaLedger(root),costs=new CostLedger(await loadCostPolicy(),root);
const cachedOnly=process.env.REVIEW_CACHED_ONLY==='true';
type Attempt={stageId:string;sourceSha256:string;sourcePath:string;status:'previous-pass-preserved'|'pass'|'fail'|'pending-review';objectiveFailures?:string[];issues?:string[]};
const results:{shotId:string;sourceId:string;status:'accepted'|'rejected'|'pending-review'|'no-source';attempts:Attempt[]}[]=[];
await quota.restore();await costs.restore();await runner.lock();const prior=quota.events.length;let failure:string|null=null;
async function progress(){
 const events=quota.events.slice(prior);await json(join(root,'visual-evidence-review.json'),{runId,sourceExecution:process.env.SOURCE_RUN_ID??null,execution:process.env.GITHUB_RUN_ID??'local',policy:'narrative-facts-v1',cachedOnly,complete:!failure&&results.length===shots.length&&!results.some(r=>r.status==='pending-review'),totalBeats:shots.length,processedBeats:results.length,failure,newImageGenerations:0,newPaidProviderCostUsd:events.reduce((n,e)=>n+e.paidUsd,0),actualGeminiModels:[...new Set(events.filter(e=>e.provider==='gemini').map(e=>e.model))],videoApproved:false,counts:Object.fromEntries(['accepted','rejected','pending-review','no-source'].map(status=>[status,results.filter(r=>r.status===status).length])),results});
}
try{await withQuota(quota,()=>withCosts(costs,async()=>{
 const vision=cachedOnly?null:new GeminiProvider();if(vision)await vision.discover();
 for(const shot of shots){
  const idea=shot.illustrationIdea!;const row={shotId:shot.id,sourceId:idea.id,status:'no-source' as 'accepted'|'rejected'|'pending-review'|'no-source',attempts:[] as Attempt[]};results.push(row);
  for(const id of [idea.id,idea.id+'-regen1']){
   const stageId=id+'-p3';let input:unknown;
   try{input=await read(join(root,'native-'+stageId+'-source.json'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
   const source=nativeSource.parse(input);
   if(source.sha256!==await fileDigest(source.path)||source.referenceSha256!==referenceSha256)throw new Error('Raw image source/reference changed: '+stageId);
   row.status='pending-review';
   const cached=await existingNarrativeReview(root,stageId,source.sha256,referenceSha256);
   let saved: {passed:boolean}|null=null;
   try{saved=await read(join(root,'native-'+stageId+'-density-QA-v4.3.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(!cached&&saved?.passed){row.status='accepted';row.attempts.push({stageId,sourceSha256:source.sha256,status:'previous-pass-preserved',sourcePath:source.path});break;}
   if(!cached&&!vision){row.attempts.push({stageId,sourceSha256:source.sha256,status:'pending-review',sourcePath:source.path});continue;}
   const review=cached??(await runner.stage(narrativeReviewStage(stageId,source.sha256),narrativeReview,async()=>({policy:'narrative-facts-v1' as const,sourceSha256:source.sha256,referenceSha256,review:await reviewDensity(reference,source.path,idea,style,vision!)}))).review;
   row.attempts.push({stageId,sourceSha256:source.sha256,sourcePath:source.path,status:review.passed?'pass':'fail',objectiveFailures:review.objectiveFailures,issues:review.issues});
   if(review.passed){row.status='accepted';break;}
  }
  if(row.status!=='accepted')row.status=row.attempts.some(a=>a.status==='pending-review')?'pending-review':row.attempts.length?'rejected':'no-source';
  await progress();
 }
 // Presentation of existing pixels only; no image generator or new style audition.
 for(const status of ['accepted','rejected','pending-review'] as const){const images=results.filter(r=>r.status===status).map(r=>({id:r.shotId,path:r.attempts.at(-1)!.sourcePath}));if(images.length)await illustrationContactSheet(images,join(root,'visual-evidence-'+status+'.jpg'),join(root,'visual-evidence-tiles',status),4,true);}
}));}catch(e){failure=String(e);throw e;}finally{try{await progress();await costs.report();await quota.report();}finally{await runner.unlock();}}
