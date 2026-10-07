import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {exec} from '../orchestration/io';
import type {VisionProvider} from '../providers/interfaces';
import type {MediaAsset,Shot} from '../editor/schemas';
import type {VisualBible} from './bible';
export const semanticQA=z.object({passed:z.boolean(),issues:z.array(z.string()),review:z.string()});
export async function semanticReview(context:unknown,bible:VisualBible,shots:Shot[],assets:MediaAsset[],llm:VisionProvider){
 const reviews=[];
 for(let offset=0;offset<assets.length;offset+=8){const batch=assets.slice(offset,offset+8);const images=[];for(const a of batch){const path=a.path+'.review.jpg';await exec('ffmpeg',['-y','-v','error','-i',a.path,'-vf','scale=768:-2','-frames:v','1',path],{timeout:20000});images.push({mimeType:'image/jpeg',data:(await readFile(path)).toString('base64')});}
 reviews.push(await llm.images(`Review these ordered generated images against each shot narration and visual bible. Recurring portraits and duplicate assets are intentional canonical/editorial reuse; never fail solely because an asset repeats. Canonical merchant shots use reference portrait/costume crops rather than literal new action/location images. Evaluate them for identity continuity, not for environmental detail content. Hard fail only on major objective defects: identity drift, broken image, major anachronism or unrelated subject. Minor composition, beauty, color or attractiveness are REVIEW notes in review and must keep passed:true. Compare canonical face, age, hair, skin, build, costume, jewelry and props whenever the recurring merchant appears. Identify clear anachronisms, blank frames, inconsistent era/clothes/architecture, unrelated subjects or excessive embedded text. Historical reconstructions are illustrative, not archival evidence. Detect unsupported claims/undisclosed reconstruction. Return {passed:boolean,issues:[string],review:string}. Context ${JSON.stringify({context,bible,shots:batch.map(a=>shots.find(s=>s.id===a.shotId))})}`,images,semanticQA));}
 return semanticQA.parse({passed:reviews.length>0&&reviews.every(r=>r.passed),issues:reviews.flatMap(r=>r.issues),review:reviews.map(r=>r.review).join('\n')});
}
