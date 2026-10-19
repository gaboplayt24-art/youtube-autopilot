import {z} from 'zod';
import type {StorageProvider} from '../providers/interfaces';
export const monthlyProduction=z.object({
 enabled:z.boolean(),startsAt:z.string().datetime(),endsAt:z.string().datetime(),
 maxEpisodes:z.number().int().min(1).max(4),maxAttemptsPerEpisode:z.number().int().min(1).max(7),maxAttempts:z.number().int().min(1).max(28),
 geminiModel:z.literal('gemini-3.1-flash-lite'),autoScheduleShorts:z.boolean(),
 sameDayRepair:z.object({runId:z.string(),sourceRunId:z.string().regex(/^\d+$/),revisionSha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional(),
 episodes:z.array(z.object({runId:z.string().regex(/^bible-[a-z0-9-]+$/),notBefore:z.string().datetime(),topic:z.string().min(20),retryFrom:z.enum(['visuals']).optional(),repairSourceRunId:z.string().regex(/^\d+$/).optional()})).min(1).max(4)
}).superRefine((c,ctx)=>{
 if(Date.parse(c.endsAt)<=Date.parse(c.startsAt)||Date.parse(c.endsAt)-Date.parse(c.startsAt)>32*86400000)ctx.addIssue({code:'custom',message:'Monthly plan must cover at most32 days'});
 if(new Set(c.episodes.map(e=>e.runId)).size!==c.episodes.length||c.episodes.length>c.maxEpisodes)ctx.addIssue({code:'custom',message:'Distinct episodes within plan limit required'});
 for(const e of c.episodes)if(Date.parse(e.notBefore)<Date.parse(c.startsAt)||Date.parse(e.notBefore)>=Date.parse(c.endsAt))ctx.addIssue({code:'custom',message:'Episode must start inside plan window'});
 for(const e of c.episodes)if(!!e.retryFrom!==!!e.repairSourceRunId)ctx.addIssue({code:'custom',message:'A targeted repair must be bound to its exact source run'});
 if(c.sameDayRepair&&!c.episodes.some(e=>e.runId===c.sameDayRepair!.runId))ctx.addIssue({code:'custom',message:'Same-day repair must belong to the monthly queue'});
});
export type MonthlyProduction=z.infer<typeof monthlyProduction>;
export function monthlyShortsAuthorized(c:MonthlyProduction,runId:string,now=new Date()){
 return c.enabled&&c.autoScheduleShorts&&now.getTime()>=Date.parse(c.startsAt)&&now.getTime()<Date.parse(c.endsAt)&&c.episodes.some(e=>e.runId===runId);
}
export type ProductionRun={id:number;display_title:string;created_at:string;status:string;conclusion:string|null};
export async function reserveMonthlyAttempt(store:Pick<StorageProvider,'create'>,runId:string,now=new Date(),repairSourceRunId?:string){
 if(repairSourceRunId)z.string().regex(/^\d+$/).parse(repairSourceRunId);
 const key=repairSourceRunId?'monthly-production-repair-'+repairSourceRunId:'monthly-production-day-'+now.toISOString().slice(0,10);
 return store.create(key,{runId,repairSourceRunId,state:'dispatch-reserved',at:now.toISOString(),note:'Retain reservation even if dispatch outcome is uncertain; never delete it to force a retry.'});
}
export function monthlyDispatchArguments(c:MonthlyProduction,runId:string,sourceRunId?:string){
 const episode=c.episodes.find(e=>e.runId===runId);if(!episode)throw Error('Episode outside monthly queue');
 const args=['workflow','run','production-validation.yml','--ref','main','-f','run_id='+episode.runId,'-f','style=v5','-f','production_kind=quality_test','-f','task=video','-f','gemini_model='+c.geminiModel,'-f','llm_provider=gemini','-f','owner_thumbnail=false','-f','publish=true','-f','topic='+episode.topic];
 if(sourceRunId){z.string().regex(/^\d+$/).parse(sourceRunId);args.push('-f','source_run_id='+sourceRunId);}
 if(sourceRunId===episode.repairSourceRunId&&episode.retryFrom)args.push('-f','retry_from='+episode.retryFrom);
 return args;
}
const active=(r:ProductionRun)=>r.status!=='completed';
/** Fail closed on active jobs, completed episodes and spending/attempt limits. Never grants QA approval. */
export function monthlyDecision(c:MonthlyProduction,runs:ProductionRun[],now=new Date()){
 const base={runId:undefined as string|undefined,blockedEpisodes:[] as string[],repairSourceRunId:undefined as string|undefined};
 if(!c.enabled)return {...base,decision:'disabled'};
 if(now.getTime()<Date.parse(c.startsAt))return {...base,decision:'not-started'};
 if(now.getTime()>=Date.parse(c.endsAt))return {...base,decision:'plan-ended'};
 if(runs.some(active))return {...base,decision:'production-active'};
 const attempts=runs.filter(r=>c.episodes.some(e=>r.display_title==='production-'+e.runId)&&Date.parse(r.created_at)>=Date.parse(c.startsAt));
 if(attempts.length>=c.maxAttempts)return {...base,decision:'monthly-attempt-limit'};
 if(attempts.some(r=>r.created_at.slice(0,10)===now.toISOString().slice(0,10))){
  const repair=c.sameDayRepair,source=repair&&attempts.find(r=>String(r.id)===repair.sourceRunId&&r.display_title==='production-'+repair.runId&&r.conclusion==='failure');
  if(repair&&source){
   const history=attempts.filter(r=>r.display_title==='production-'+repair.runId),episode=c.episodes.find(e=>e.runId===repair.runId)!;
   if(history.length<c.maxAttemptsPerEpisode&&!history.some(r=>r.id>source.id)&&!runs.some(r=>r.display_title===source.display_title&&r.conclusion==='success')&&Date.parse(episode.notBefore)<=now.getTime())return {...base,decision:'ready',runId:repair.runId,repairSourceRunId:repair.sourceRunId};
  }
  return {...base,decision:'daily-cooldown'};
 }
 for(const episode of c.episodes){
  const history=runs.filter(r=>r.display_title==='production-'+episode.runId);
  if(history.some(r=>r.conclusion==='success'))continue;
  if(attempts.filter(r=>r.display_title==='production-'+episode.runId).length>=c.maxAttemptsPerEpisode){base.blockedEpisodes.push(episode.runId);continue;}
  if(Date.parse(episode.notBefore)<=now.getTime())return {...base,decision:'ready',runId:episode.runId};
 }
 return {...base,decision:'waiting-next-slot-or-complete'};
}
