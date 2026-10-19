import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {continuationIdentity} from '../src/orchestration/continuation';
import {appendFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {read,exec} from '../src/orchestration/io';
import {monthlyProduction,monthlyDecision,monthlyDispatchArguments,reserveMonthlyAttempt} from '../src/orchestration/monthly-production';
import {SupabaseStorage} from '../src/database/storage';
async function main(){
 const c=monthlyProduction.parse(await read('config/monthly-production.json')),repo=process.env.GITHUB_REPOSITORY;
 if(repo!=='gaboplayt24-art/youtube-autopilot')throw Error('Approved repository only');
 const api=async(path:string,filter:string)=>JSON.parse((await exec('gh',['api',`repos/${repo}/${path}`,'--jq',filter],{timeout:30000})).stdout);
 // Read the full plan window, not an attempt-count-limited history slice.
 const runs=[];for(let page=1;;page++){
  const result=await api(`actions/workflows/production-validation.yml/runs?per_page=100&page=${page}`,'[.workflow_runs[]|{id,display_title,conclusion,created_at,status}]');
  runs.push(...z.array(z.object({id:z.number(),display_title:z.string(),conclusion:z.string().nullable(),created_at:z.string(),status:z.string()})).parse(result));if(result.length<100||result.every((r:{created_at:string})=>Date.parse(r.created_at)<Date.parse(c.startsAt)))break;
 }
 const decision=monthlyDecision(c,runs);let sourceRunId:string|undefined,dispatched=false,resumeAfter:string|undefined;
 if(decision.decision==='ready'){
  const episode=c.episodes.find(e=>e.runId===decision.runId)!;
  const history=runs.filter(r=>r.display_title==='production-'+episode.runId);
  if(history.length){
   const release=await api('releases/tags/pipeline-checkpoint-'+episode.runId,'{assets:[.assets[]|{name,created_at,id}]}');
   const manifests=release.assets.filter((a:{name:string})=>/^run-[0-9]+-attempt-[0-9]+\.manifest\.json$/.test(a.name)).sort((a:{created_at:string;id:number},b:{created_at:string;id:number})=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
   if(!manifests.length)throw Error('Existing production requires its checkpoint; never restart it from zero');
   sourceRunId=manifests[0].name.match(/^run-([0-9]+)-/)[1];
   if(c.retryPolicy==='continuous'){
    const folder=await mkdtemp(join(tmpdir(),'continuation-manifest-'));
    try{await exec('gh',['release','download','pipeline-checkpoint-'+episode.runId,'--pattern',manifests[0].name,'--dir',folder],{timeout:30000});
     const manifest=z.object({runId:z.literal(episode.runId),sourceRunId:z.literal(sourceRunId!),continuation:z.object({resumeAfter:z.string().datetime().optional()}).optional()}).parse(JSON.parse(await readFile(join(folder,manifests[0].name),'utf8')));
     resumeAfter=manifest.continuation?.resumeAfter;
    }finally{await rm(folder,{recursive:true,force:true});}
   }
  }
  if(decision.repairSourceRunId){
   if(sourceRunId!==decision.repairSourceRunId)throw Error('Prepared repair requires its exact latest checkpoint');
   const bytes=await readFile(`data/scripts/${episode.runId}-visual-revisions.json`);
   if(createHash('sha256').update(bytes).digest('hex')!==c.sameDayRepair?.revisionSha256)throw Error('Prepared repair digest mismatch');
  }
  if(resumeAfter&&Date.parse(resumeAfter)>Date.now())decision.decision='provider-quota-reset-pending';
  if(decision.decision==='ready'&&process.env.DISPATCH_READY==='true'){
   if(!await reserveMonthlyAttempt(new SupabaseStorage(),episode.runId,new Date(),decision.repairSourceRunId,c.retryPolicy==='continuous'?await continuationIdentity(episode.runId,sourceRunId??'new'):undefined))decision.decision='dispatch-reservation-exists';
   else {await exec('gh',monthlyDispatchArguments(c,episode.runId,sourceRunId),{timeout:30000});dispatched=true;}
  }
 }
 const report={...decision,sourceRunId,resumeAfter,dispatched,startsAt:c.startsAt,endsAt:c.endsAt,requiresOwnerRenewal:false,qualityGatesUnchanged:true};console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Monthly autonomous production\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\nBlocked episodes are retained, never published or treated as approval. Financial quota ledger is unchanged.\n');
}
main().catch(()=>{console.error('Monthly production controller failed; no blind dispatch retry or quota override.');process.exitCode=1;});
