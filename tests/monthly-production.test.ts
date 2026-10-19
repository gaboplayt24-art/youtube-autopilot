import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {monthlyProduction,monthlyDecision,monthlyDispatchArguments,reserveMonthlyAttempt,monthlyShortsAuthorized,type ProductionRun} from '../src/orchestration/monthly-production';
import {exec} from '../src/orchestration/io';
import {LocalStorage} from '../src/database/storage';
import {editorialDraftSchema} from '../src/script';
const policy=monthlyProduction.parse({enabled:true,startsAt:'2026-10-19T00:00:00Z',endsAt:'2026-11-19T00:00:00Z',maxEpisodes:2,maxAttemptsPerEpisode:7,maxAttempts:14,geminiModel:'gemini-3.1-flash-lite',autoScheduleShorts:true,episodes:[{runId:'bible-first',notBefore:'2026-10-19T00:00:00Z',topic:'A source-grounded biblical episode'},{runId:'bible-second',notBefore:'2026-10-26T00:00:00Z',topic:'Another original biblical episode'}]});
const now=new Date('2026-10-30T12:00:00Z');
test('automatic Shorts authorization is episode-bound, time-bound and independently revocable',()=>{
 assert.equal(monthlyShortsAuthorized(policy,'bible-first',now),true);
 assert.equal(monthlyShortsAuthorized(policy,'bible-unplanned',now),false);
 assert.equal(monthlyShortsAuthorized({...policy,enabled:false},'bible-first',now),false);
 assert.equal(monthlyShortsAuthorized({...policy,autoScheduleShorts:false},'bible-first',now),false);
 assert.equal(monthlyShortsAuthorized(policy,'bible-first',new Date(policy.endsAt)),false);
});
const run=(id:number,overrides:Partial<ProductionRun>={}):ProductionRun=>({id,display_title:'production-bible-first',created_at:'2026-10-28T12:00:00Z',status:'completed',conclusion:'failure',...overrides});
test('monthly standing authorization survives three failures without a renewal request',()=>{
 assert.equal(monthlyDecision(policy,[run(1),run(2),run(3)],now).decision,'ready');
 assert.equal(monthlyDecision(policy,[run(1),run(2),run(3)],now).runId,'bible-first');
});
test('active work, daily cooldown, monthly bound and shutdown prevent duplicate or unlimited dispatch',()=>{
 assert.equal(monthlyDecision(policy,[run(1,{status:'queued',display_title:'production-unrelated'})],now).decision,'production-active');
 assert.equal(monthlyDecision(policy,[run(1,{created_at:now.toISOString()})],now).decision,'daily-cooldown');
 assert.equal(monthlyDecision({...policy,maxAttempts:1},[run(1)],now).decision,'monthly-attempt-limit');
 assert.equal(monthlyDecision({...policy,enabled:false},[],now).decision,'disabled');
 assert.equal(monthlyDecision(policy,[],new Date(policy.endsAt)).decision,'plan-ended');
});
test('exhausted episodes do not block the next due episode; successful episodes never duplicate',()=>{
 const history=Array.from({length:7},(_,i)=>run(i));const decision=monthlyDecision(policy,history,now);
 assert.equal(decision.runId,'bible-second');assert.deepEqual(decision.blockedEpisodes,['bible-first']);
 assert.equal(monthlyDecision(policy,[run(1,{conclusion:'success'})],now).runId,'bible-second');
 assert.equal(monthlyDecision(policy,[run(1,{conclusion:'success'})],new Date('2026-10-20T12:00:00Z')).decision,'waiting-next-slot-or-complete');
 assert.throws(()=>monthlyProduction.parse({...policy,episodes:[policy.episodes[0],policy.episodes[0]]}));
});
test('all queued future episodes have validated primary-source briefs and real chapter clip selections',async()=>{
 const c=monthlyProduction.parse(JSON.parse(await readFile('config/monthly-production.json','utf8')));
 for(const e of c.episodes){const draft=editorialDraftSchema.parse(JSON.parse(await readFile(`data/scripts/${e.runId}-editorial-draft.json`,'utf8')));assert.ok(draft.requiredEvidence?.urls.length);assert.ok(draft.sourceUrls.every(url=>url.startsWith('https://www.biblegateway.com/')||e.runId==='bible-noah-003'));const clips=JSON.parse(await readFile(`data/ideas/${e.runId}-shorts-chapters.json`,'utf8'));assert.equal(clips.runId,e.runId);assert.equal(clips.chapters.length,3);}
});
test('real monthly CLI resumes exact checkpoint and binds one-time repair, with no new credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monthly-cli-'));
 try{
  await mkdir(join(dir,'config'));const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+86400000).toISOString();
  const c={...policy,startsAt:start,endsAt:end,episodes:[{...policy.episodes[0],notBefore:start,retryFrom:'visuals',repairSourceRunId:'777'}],maxEpisodes:1};
  await writeFile(join(dir,'config/monthly-production.json'),JSON.stringify(c));const argsPath=join(dir,'dispatch.json');
  await writeFile(join(dir,'gh'),'#!/usr/bin/env node\n'+
   'const fs=require("node:fs"),args=process.argv.slice(2);if(args[0]==="workflow"){fs.writeFileSync(process.env.MONTHLY_ARGS,JSON.stringify(args));process.exit(0);}'+
   'if(args[0]!=="api")process.exit(90);process.stdout.write(JSON.stringify(args[1].includes("releases/")?{assets:[{name:"run-777-attempt-1.manifest.json",created_at:"2026-10-19T00:00:00Z",id:1}]}:[{id:777,display_title:"production-bible-first",conclusion:"failure",created_at:"2020-01-01T00:00:00Z",status:"completed"}]));\n',{mode:0o755});
  const invoke=(dispatch:string)=>exec(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),resolve('scripts/monthly-production.ts')],{cwd:dir,env:{...process.env,PATH:dir+':'+process.env.PATH,GITHUB_REPOSITORY:'gaboplayt24-art/youtube-autopilot',GITHUB_STEP_SUMMARY:'',DISPATCH_READY:dispatch,MONTHLY_ARGS:argsPath},timeout:30000});
  const preview=JSON.parse((await invoke('false')).stdout);assert.equal(preview.decision,'ready');assert.equal(preview.dispatched,false);assert.equal(preview.sourceRunId,'777');
  let args=monthlyDispatchArguments(monthlyProduction.parse(c),'bible-first','777');assert.ok(args.includes('source_run_id=777'));assert.ok(args.includes('retry_from=visuals'));assert.ok(args.includes('publish=true'));assert.ok(args.includes('style=v5'));assert.ok(args.includes('production_kind=quality_test'));
  c.episodes[0].repairSourceRunId='888';args=monthlyDispatchArguments(monthlyProduction.parse(c),'bible-first','777');assert.ok(!args.includes('retry_from=visuals'),'Later checkpoints must not discard their completed render');

 }finally{await rm(dir,{recursive:true,force:true});}
});

test('durable daily reservation allows only one winner and retains uncertain dispatches until next day',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monthly-reservation-'));
 try{const store=new LocalStorage(dir),now=new Date('2026-10-30T12:00:00Z');const winners=await Promise.all([reserveMonthlyAttempt(store,'bible-first',now),reserveMonthlyAttempt(store,'bible-second',now)]);assert.equal(winners.filter(Boolean).length,1);assert.equal(await reserveMonthlyAttempt(store,'bible-first',now),false);assert.equal(await reserveMonthlyAttempt(store,'bible-first',new Date('2026-10-31T00:35:00Z')),true);}finally{await rm(dir,{recursive:true,force:true});}
});
