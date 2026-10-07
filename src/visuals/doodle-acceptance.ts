import {z} from 'zod';
import {join} from 'node:path';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import type {ShotPlan} from '../editor/schemas';
import {shotPlan,media} from '../editor/schemas';
import {Runner} from '../orchestration/runner';
import {read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {VisualThinkingDirector} from './visual-thinking';
import {createDoodleAssets} from './doodle-assets';
import {reviewDoodleSet,doodleSetQA} from './doodle-set-qa';
import {inspectVisualIdeas} from './doodle-qa';
const accepted=z.object({shots:shotPlan,visuals:media,review:doodleSetQA.nullable(),repairedShotIds:z.array(z.string())});
export async function acceptDoodleVisuals(initial:ShotPlan,dir:string,runner:Runner,llm?:LLMProvider&VisionProvider){
 return runner.stage('doodle-acceptance-layout-v2',accepted,async()=>{
  let candidate=initial;const repaired=new Set<string>();
  const repair=async(name:string,review:z.infer<typeof doodleSetQA>)=>{
   const outliers=review.reviews.filter(r=>!r.passed||!r.styleCompliant||!r.subjectMatches||!r.historicallyPlausible||!r.readable||r.issues.length).map(r=>({shotId:r.shotId,issues:r.issues.length?r.issues:['Objective frame review failed']}));
   if(!llm||!outliers.length)throw new Error('Actual-image QA rejected frames; evidence retained, no render');
   for(const o of outliers)repaired.add(o.shotId);
   const current=candidate;candidate=await runner.stage(name,shotPlan,async()=>({...current,shots:await new VisualThinkingDirector().repair(current.shots,outliers,llm)}));
  };
  // Migrate this NEW doodle run's first rejection; never import old painted
  // visuals. The original JSON/PNGs/review remain immutable technical evidence.
  let prior:z.infer<typeof doodleSetQA>|undefined;try{prior=doodleSetQA.parse(await read(join(dir,'doodle-style-semantic-QA.json')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(prior&&!prior.passed)await repair('doodle-repair-layout-v2-initial',prior);
  for(let round=0;round<3;round++){
   const structural=inspectVisualIdeas(candidate.shots);await json(join(dir,'visual-thinking-QA-layout-v2-round-'+round+'.json'),structural);if(!structural.passed)throw new Error('Educational concept QA failed');
   const visuals=await runner.stage('doodle-assets-layout-v2-round-'+round,media,()=>createDoodleAssets(candidate.shots,join(dir,'assets','doodle-layout-v2','round-'+round)),async v=>{for(const a of v.assets)if(await fileDigest(a.path)!==a.sha256)throw new Error('Doodle asset integrity failure');});
   const review=llm?await runner.stage('doodle-style-semantic-layout-v2-round-'+round,doodleSetQA,()=>reviewDoodleSet(candidate.shots,visuals.assets,llm)):null;
   if(!review||review.passed){await json(join(dir,'visual-thinking-QA.json'),structural);return {shots:candidate,visuals,review,repairedShotIds:[...repaired]};}
   if(round===2)throw new Error('Actual-image educational style/semantic QA failed after bounded repairs; rejected evidence preserved, no render');
   await repair('doodle-repair-layout-v2-round-'+(round+1),review);
  }
  throw new Error('Educational acceptance exhausted');
 },async a=>{for(const asset of a.visuals.assets)if(await fileDigest(asset.path)!==asset.sha256)throw new Error('Accepted doodle source integrity failure');if(llm&&!a.review?.passed)throw new Error('Missing actual-image approval');});
}
