import {appendFile} from 'node:fs/promises';
import {qualityResumeConfig,qualityResumeDecision,assertFreeQuotaReset} from '../src/orchestration/quality-quota-resume';
import {read,json,exec} from '../src/orchestration/io';
import {z} from 'zod';
async function main(){
 const config=qualityResumeConfig.parse(await read('config/quality-quota-resume.json')),now=new Date(),dir='.cache/quality-reset';let decision=qualityResumeDecision(config,now);
 if(decision==='ready'){
  const repository=process.env.GITHUB_REPOSITORY;if(repository!=='gaboplayt24-art/youtube-autopilot')throw new Error('Resume is restricted to the authorized repository');
  const {stdout}=await exec('gh',['api',`repos/${repository}/actions/workflows/quality-test-free.yml/runs?per_page=1`],{timeout:30000});
  const latest=z.object({workflow_runs:z.array(z.object({id:z.number(),conclusion:z.string().nullable()})).min(1)}).parse(JSON.parse(stdout)).workflow_runs[0];decision=qualityResumeDecision(config,now,latest.id);if(decision==='ready'&&latest.conclusion!=='failure')decision='source_not_failed';
 }
 const ready=decision==='ready';await json(dir+'/scheduler-status.json',{decision,runId:config.runId,sourceRunId:config.sourceRunId,notBefore:config.notBefore,expiresAt:config.expiresAt,paidProviderCostUsd:0,publicYouTubePublication:false});
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`ready=${ready}\nrun_id=${config.runId}\nsource_run_id=${config.sourceRunId}\n`);
 console.log(JSON.stringify({event:'quality_resume_guard',decision}));
 if(process.argv.includes('--dispatch')&&ready){
  assertFreeQuotaReset(await read(dir+'/quota-checkpoint.json'),now);
  await exec('gh',['workflow','run','quality-test-free.yml','--ref','main','-f',`run_id=${config.runId}`,'-f',`source_run_id=${config.sourceRunId}`,'-f','gemini_free_tier_confirmed=true','-f','cloudflare_free_plan_confirmed=true'],{timeout:30000});
  await json(dir+'/resume-dispatch.json',{dispatched:true,at:now.toISOString(),runId:config.runId,sourceRunId:config.sourceRunId,workflow:'quality-test-free.yml',paidFallback:false,publicYouTubePublication:false});
 }
}
main().catch(error=>{console.error(String(error));process.exitCode=1;});
