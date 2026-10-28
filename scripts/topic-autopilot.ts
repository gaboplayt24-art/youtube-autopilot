// Weekly topic autopilot (owner-authorized 2026-10-28): roll the monthly window, and when fewer than two episodes
// are pending, measure public demand for unused catalog topics and queue the strongest with its brief. The workflow
// commits the result; the existing controller then produces it with every QA gate and budget unchanged.
import {readdir,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {read,exec,json} from '../src/orchestration/io';
import {monthlyProduction} from '../src/orchestration/monthly-production';
import {topicCatalog,rankTopics,usedTopicIds,nextRunId,episodeFiles,rollQueue,needsTopics} from '../src/ideas/topic-autopilot';
import {researchBiblicalDemand} from '../src/ideas/biblical-demand';
import {FreeQuotaLedger,withQuota} from '../src/quota';

const repo=process.env.GITHUB_REPOSITORY;if(repo!=='gaboplayt24-art/youtube-autopilot')throw Error('Approved repository only');
const raw=await read('config/monthly-production.json') as Record<string,unknown>,c=monthlyProduction.parse(raw),catalog=topicCatalog.parse(await read('config/topic-catalog.json'));
const runs=z.array(z.object({id:z.number(),display_title:z.string(),conclusion:z.string().nullable(),created_at:z.string(),updated_at:z.string().optional(),status:z.string()})).parse(JSON.parse((await exec('gh',['api',`repos/${repo}/actions/workflows/production-validation.yml/runs?per_page=100`,'--jq','[.workflow_runs[]|{id,display_title,conclusion,created_at,updated_at,status}]'],{timeout:30000})).stdout));
const files=await readdir('data/scripts'),now=new Date();
const picks:({runId:string;topic:string}&ReturnType<typeof episodeFiles>)[]=[];let evidence:unknown=null;
if(needsTopics(c,runs)){
 const unused=catalog.topics.filter(t=>!usedTopicIds(files).has(t.id)),quota=new FreeQuotaLedger('data/research/topic-autopilot');await quota.restore();
 try{const report=await withQuota(quota,()=>researchBiblicalDemand(undefined,now,unused.map(t=>({topic:t.id,query:t.query}))));
  const ranked=rankTopics(unused,report.topics,usedTopicIds(files),now);
  evidence={generatedAt:report.generatedAt,limitations:report.limitations,ranking:ranked.map(r=>({id:r.topic.id,score:Math.round(r.score),demand:report.topics.find(d=>d.topic===r.topic.id)&&{sampleSize:report.topics.find(d=>d.topic===r.topic.id)!.sampleSize,distinctChannels:report.topics.find(d=>d.topic===r.topic.id)!.distinctChannels,medianViewsPerDay:report.topics.find(d=>d.topic===r.topic.id)!.medianViewsPerDay}}))};
  const taken=[...files];
  for(const r of ranked.slice(0,2)){const runId=nextRunId(taken,r.topic.id);taken.push(runId+'-editorial-draft.json');picks.push({runId,topic:r.topic.topic,...episodeFiles(r.topic,runId)});}
 }finally{await quota.report();}
}
const rolled=monthlyProduction.parse(rollQueue(c,runs,picks,now));
const dropped=c.episodes.filter(e=>!rolled.episodes.some(x=>x.runId===e.runId)).map(e=>({runId:e.runId,topic:e.topic,leftQueueAt:now.toISOString()}));
const next={...raw,startsAt:rolled.startsAt,endsAt:rolled.endsAt,maxEpisodes:rolled.maxEpisodes,episodes:rolled.episodes,deliveredEpisodes:[...((raw.deliveredEpisodes as unknown[])??[]),...dropped]};
await writeFile('config/monthly-production.json',JSON.stringify(next,null,2)+'\n');
// Briefs are written only for topics that actually entered the queue, so unused picks stay available.
const queued=picks.filter(p=>rolled.episodes.some(e=>e.runId===p.runId));
for(const p of queued){await writeFile(`data/scripts/${p.runId}-editorial-draft.json`,JSON.stringify(p.draft,null,2)+'\n');await writeFile(`data/scripts/${p.runId}-chapter-titles.json`,JSON.stringify(p.titles,null,2)+'\n');}
if(evidence)await json(`data/research/topic-autopilot/${now.toISOString().slice(0,10)}.json`,evidence);
console.log(JSON.stringify({queued:queued.map(p=>p.runId),dropped:dropped.map(d=>d.runId),window:[rolled.startsAt,rolled.endsAt]}));
