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
import {reviewDensity,narrativeReview,narrativeReviewStage} from './density-qa';
const runId=z.string().regex(/^[A-Za-z0-9_-]+$/).parse(process.env.RUN_ID);
const root=join('data/runs',runId),reference='assets/references/style-v5-eli.png';
const style=illustratedStyleLock.parse(await read('config/style-lock-v5.json'));
const referenceSha256=await fileDigest(reference);
if(referenceSha256!==style.referenceSha256)throw new Error('Reference identity mismatch');
const plan=shotPlan.parse(await read(join(root,'visual-thinking-v5.json')));
const revision=editorialRevision.parse(await read(join('data/scripts',runId+'-visual-revisions.json')));
const shots=applyEditorialRevision(plan.shots,revision,runId);
const runner=new Runner(root),quota=new FreeQuotaLedger(root),costs=new CostLedger(await loadCostPolicy(),root);
await quota.restore();await costs.restore();await runner.lock();const prior=quota.events.length;
try{await withQuota(quota,()=>withCosts(costs,async()=>{
 const vision=new GeminiProvider();await vision.discover();const results=[];
 for(const shot of shots){
  const idea=shot.illustrationIdea!;const attempts=[];let accepted=false;
  for(const id of [idea.id,idea.id+'-regen1']){
   const stageId=id+'-p3';let input:unknown;
   try{input=await read(join(root,'native-'+stageId+'-source.json'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
   const source=nativeSource.parse(input);
   if(source.sha256!==await fileDigest(source.path)||source.referenceSha256!==referenceSha256)throw new Error('Raw image source/reference changed: '+stageId);
   let saved: {passed:boolean}|null=null;
   try{saved=await read(join(root,'native-'+stageId+'-density-QA-v4.3.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(saved?.passed){accepted=true;attempts.push({stageId,sourceSha256:source.sha256,status:'previous-pass-preserved',sourcePath:source.path});break;}
   const evidence=await runner.stage(narrativeReviewStage(stageId,source.sha256),narrativeReview,async()=>({policy:'narrative-facts-v1' as const,sourceSha256:source.sha256,referenceSha256,review:await reviewDensity(reference,source.path,idea,style,vision)}));
   attempts.push({stageId,sourceSha256:source.sha256,sourcePath:source.path,status:evidence.review.passed?'pass':'fail',objectiveFailures:evidence.review.objectiveFailures,issues:evidence.review.issues});
   if(evidence.review.passed){accepted=true;break;}
  }
  results.push({shotId:shot.id,sourceId:idea.id,status:accepted?'accepted':attempts.length?'rejected':'no-source',attempts});
 }
 const events=quota.events.slice(prior);await json(join(root,'visual-evidence-review.json'),{runId,sourceExecution:process.env.SOURCE_RUN_ID??null,execution:process.env.GITHUB_RUN_ID??'local',policy:'narrative-facts-v1',newImageGenerations:0,newPaidProviderCostUsd:events.reduce((n,e)=>n+e.paidUsd,0),actualGeminiModels:[...new Set(events.filter(e=>e.provider==='gemini').map(e=>e.model))],videoApproved:false,counts:{accepted:results.filter(r=>r.status==='accepted').length,rejected:results.filter(r=>r.status==='rejected').length,noSource:results.filter(r=>r.status==='no-source').length},results});
}));}finally{await costs.report();await quota.report();await runner.unlock();}
