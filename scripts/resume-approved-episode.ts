import {appendFile} from 'node:fs/promises';
import {z} from 'zod';
import {read,exec} from '../src/orchestration/io';
const config=z.object({llmProvider:z.enum(['gemini','groq']).default('gemini'),groqFreePlanConfirmed:z.boolean().default(false),uploadPrivateForOwnerThumbnail:z.literal(true),maxAttempts:z.number().int().min(1).max(3),enabled:z.boolean(),runId:z.literal('bible-angels-001'),notBefore:z.string().datetime(),expiresAt:z.string().datetime(),geminiModel:z.literal('gemini-3.1-flash-lite'),topic:z.string(),ownerThumbnail:z.literal(true),publish:z.literal(false)});
async function main(){
 const c=config.parse(await read('config/episode-delivery.json')),now=new Date(),repo=process.env.GITHUB_REPOSITORY;
 if(repo!=='gaboplayt24-art/youtube-autopilot')throw Error('Approved repository only');
 let decision=!c.enabled?'disabled':now.getTime()<Date.parse(c.notBefore)?'before-free-quota-reset':now.getTime()>Date.parse(c.expiresAt)?'expired':'ready';
 // Keep GitHub's full run/release payload out of execFile's 1 MiB stdout buffer.
 // Filtering in gh preserves the complete 100-run decision window without truncation.
 const api=async(path:string,filter:string)=>JSON.parse((await exec('gh',['api',`repos/${repo}/${path}`,'--jq',filter],{timeout:30000})).stdout);
 let sourceRunId:string|undefined;
 if(decision==='ready'){
  const runs=await api('actions/workflows/production-validation.yml/runs?per_page=100','{workflow_runs: [.workflow_runs[] | {display_title, conclusion, created_at, status}]}');
  const episode=runs.workflow_runs.filter((r:any)=>r.display_title==='production-'+c.runId);
  if(episode.some((r:any)=>r.conclusion==='success'&&Date.parse(r.created_at)>=Date.parse(c.notBefore)))decision='video-qa-completed';
  else if(episode.filter((r:any)=>Date.parse(r.created_at)>=Date.parse(c.notBefore)).length>=c.maxAttempts)decision='attempt-cap-reached';
  else if(episode.some((r:any)=>r.created_at.startsWith(now.toISOString().slice(0,10))||['queued','in_progress','waiting','requested'].includes(r.status)))decision='attempt-already-started';
  if(decision==='ready'){
   const release=await api('releases/tags/pipeline-checkpoint-'+c.runId,'{assets: [.assets[] | {name, created_at, id}]}');
   const assets=release.assets.filter((a:any)=>/^run-[0-9]+-attempt-[0-9]+\.manifest\.json$/.test(a.name)).sort((a:any,b:any)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
   if(!assets.length)throw Error('Complete checkpoint required');sourceRunId=assets[0].name.match(/^run-([0-9]+)-/)[1];
   if(process.env.DISPATCH_READY==='true')await exec('gh',['workflow','run','production-validation.yml','--ref','main','-f','run_id='+c.runId,'-f','source_run_id='+sourceRunId,'-f','style=v5','-f','production_kind=quality_test','-f','task=video','-f','gemini_model='+c.geminiModel,'-f','llm_provider='+c.llmProvider,'-f','groq_free_plan_confirmed='+c.groqFreePlanConfirmed,'-f','owner_thumbnail=true','-f','upload_private_for_owner_thumbnail=true','-f','publish=false','-f','topic='+c.topic],{timeout:30000});
  }
 }
 const report={decision,runId:c.runId,sourceRunId,dispatched:decision==='ready'&&process.env.DISPATCH_READY==='true',notBefore:c.notBefore,expiresAt:c.expiresAt,publish:false};console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Approved episode resume\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
}
main().catch(()=>{console.error('Episode resume guard failed; inspect Actions before retrying to avoid duplicate dispatch.');process.exitCode=1;});
