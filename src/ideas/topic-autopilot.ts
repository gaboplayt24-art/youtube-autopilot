// Owner-authorized 2026-10-28: the queue picks its own next topics. Briefs come from the curated catalog (real
// passages, original focus); choice uses measured public demand; the rolling window keeps the monthly controller's
// limits (at most four episodes inside 32 days). Nothing here relaxes a QA gate or a budget.
import {z} from 'zod';
import type {MonthlyProduction,ProductionRun} from '../orchestration/monthly-production';

export const topicCatalog=z.object({policy:z.string(),topics:z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/),topic:z.string().min(20),query:z.string().min(5),passages:z.array(z.string().regex(/^(?:[1-3] )?[A-Z][a-z]+ \d{1,3}$/)).min(1),focus:z.string().min(40),chapters:z.array(z.string().min(3).max(40)).length(3),season:z.array(z.number().int().min(1).max(12)).optional()})).min(1)});
export type CatalogTopic=z.infer<typeof topicCatalog>['topics'][number];
export type TopicDemand={topic:string;distinctChannels:number;medianViewsPerDay:number|null};

const passageUrl=(p:string)=>'https://www.biblegateway.com/passage/?search='+encodeURIComponent(p)+'&version=KJV';
/** Interest per day, discounted when a few channels dominate the sample, boosted in the topic's own season. */
export function topicScore(t:CatalogTopic,d:TopicDemand|undefined,now:Date){
 if(!d?.medianViewsPerDay)return 0;
 const month=now.getUTCMonth()+1,next=month%12+1;
 return d.medianViewsPerDay*Math.min(1,d.distinctChannels/6)*(t.season?.some(m=>m===month||m===next)?1.5:1);
}
export function rankTopics(catalog:CatalogTopic[],demand:TopicDemand[],used:Set<string>,now:Date){
 return catalog.filter(t=>!used.has(t.id)).map(t=>({topic:t,score:topicScore(t,demand.find(d=>d.topic===t.id),now)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
}
/** Catalog ids already turned into episodes, from the editorial drafts on disk. */
export function usedTopicIds(files:string[]){return new Set(files.flatMap(f=>f.match(/^bible-([a-z0-9-]+)-\d{3}-editorial-draft\.json$/)?.[1]??[]));}
export function nextRunId(files:string[],id:string){
 const n=Math.max(0,...files.flatMap(f=>f.match(/^bible-[a-z0-9-]+-(\d{3})-/)?.[1]??[]).map(Number))+1;
 return `bible-${id}-${String(n).padStart(3,'0')}`;
}
export function episodeFiles(t:CatalogTopic,runId:string){
 const urls=t.passages.map(passageUrl);
 const draft={provenance:'Original editorial brief from config/topic-catalog.json, chosen automatically under the owner-authorized topic autopilot (2026-10-28). No competitor scripts or artwork.',sourceUrls:urls,requiredEvidence:{urls,anchors:[]},researchFocus:t.focus,
  scriptGuidance:'Use the existing quality_test documentary target, approximately 8-12 minutes at natural narrator speed, never pad or stretch audio. Original English, direct curiosity hook, distinct sourced chapters and concise callback. Every spoken factual term/number remains subject to voice QA. Only claim what the actual retrieved passages support; distinguish text, interpretation and debate. Generated thumbnails must accurately complement the final title.',
  chapters:[{act:'HOOK',purpose:'Direct specific source-grounded curiosity, no intro or welcome; target exactly the existing opening word budget.'},
   {act:'ACT 1',purpose:t.chapters[0]+'. Introduce distinct evidence from the first source; do not repeat the hook.'},
   {act:'ACT 2',purpose:t.chapters[1]+'. Explain the textual sequence with new evidence, without inventing physical or chronological detail.'},
   {act:'ACT 3',purpose:t.chapters[2]+'. Resolve the main question with the later sources, distinguish the text from later imagery.'},
   {act:'ENDING',purpose:'Short callback to the opening question; no repeated chapter summary or new factual claims.'}]};
 return {draft,titles:{runId,titles:{'chapter-2':t.chapters[0],'chapter-3':t.chapters[1],'chapter-4':t.chapters[2]}}};
}
const delivered=(runs:ProductionRun[],runId:string)=>runs.filter(r=>r.display_title==='production-'+runId&&r.conclusion==='success');
/** Drop episodes delivered more than two days ago (their Shorts are dispatched right after upload), keep every
 * pending one, then add topics one week apart until two are pending, inside a fresh 31-day window. */
export function needsTopics(c:MonthlyProduction,runs:ProductionRun[]){return c.episodes.filter(e=>!delivered(runs,e.runId).length).length<2;}
export function rollQueue(c:MonthlyProduction,runs:ProductionRun[],picks:{runId:string;topic:string}[],now:Date):MonthlyProduction{
 const day=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const kept=c.episodes.filter(e=>!delivered(runs,e.runId).some(r=>Date.parse(r.updated_at??r.created_at)<now.getTime()-2*86400000));
 const pending=kept.filter(e=>!delivered(runs,e.runId).length).length;
 const episodes=kept.map(e=>({...e,notBefore:new Date(Math.max(day,Date.parse(e.notBefore))).toISOString()}));
 let last=Math.max(day,...episodes.map(e=>Date.parse(e.notBefore)));
 for(const p of picks.slice(0,Math.max(0,Math.min(2-pending,4-episodes.length)))){
  const at=episodes.length?last+7*86400000:day;episodes.push({runId:p.runId,notBefore:new Date(at).toISOString(),topic:p.topic});last=at;
 }
 return {...c,startsAt:new Date(day).toISOString(),endsAt:new Date(day+31*86400000).toISOString(),maxEpisodes:4,episodes};
}
