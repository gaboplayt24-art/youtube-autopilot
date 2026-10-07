import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import type {Shot,MediaAsset} from '../editor/schemas';
import type {VisionProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
import {exec} from '../orchestration/io';
import style from '../../config/style-lock-v3.json';
const frameReview=z.object({shotId:z.string(),passed:z.boolean(),styleCompliant:z.boolean(),subjectMatches:z.boolean(),historicallyPlausible:z.boolean(),readable:z.boolean(),issues:z.array(z.string())});
export const doodleSetQA=z.object({passed:z.boolean(),reviews:z.array(frameReview),method:z.literal('actual-image Gemini review')});
export async function reviewDoodleSet(shots:Shot[],assets:MediaAsset[],vision:VisionProvider){
 const reviews=[];
 for(let offset=0;offset<shots.length;offset+=6){const batch=shots.slice(offset,offset+6),images:{mimeType:string;data:string}[]=[];
  for(const shot of batch){const a=assets.find(a=>a.shotId===shot.id);if(!a)throw new Error('Missing actual doodle review image');const path=a.path+'.review.jpg';await exec('ffmpeg',['-y','-v','error','-i',a.path,'-vf','scale=960:540','-frames:v','1',path],{timeout:20000});images.push({mimeType:'image/jpeg',data:(await readFile(path)).toString('base64')});}
  const schema=z.object({reviews:z.array(frameReview)}).superRefine((v,ctx)=>{if(v.reviews.length!==batch.length||new Set(v.reviews.map(r=>r.shotId)).size!==batch.length||v.reviews.some(r=>!batch.some(s=>s.id===r.shotId)))ctx.addIssue({code:'custom',message:'Review each ordered shot exactly once by its supplied ID'});});
  const result=await validatedJSON({json:<T>(instruction:string,s:z.ZodType<T>)=>vision.images(instruction,images,s)},`Review these ACTUAL ordered educational images. Active style ${JSON.stringify(style)}. HARD REJECT photography/DSLR, movie stills, glossy CGI/Unreal, realistic skin, painterly classical realism, anime/superhero art, cinematic lighting/depth-of-field, clutter, random writing/logos/watermarks, historical anachronisms, subject/visual IDEA mismatch, unclear diagrams, overlapping or unreadable labels. The OLD painted contact sheet is forbidden. Deliberate typed compositor labels supported by narration are allowed. Simple symbolic visual thinking is expected: do not demand a literal reconstruction. A boat can represent a sea journey, a warning can represent risk. Simple 2D depth only. Relationships must not add unsupported causal/factual claims. Narration cuts may end mid-phrase: use full context to resolve references. Full story ${JSON.stringify(shots.map(s=>s.narration))}. Ordered image IDs, narration and intended ideas: ${JSON.stringify(batch.map(s=>({shotId:s.id,narration:s.narration,idea:s.visualIdea})))}. Return {reviews:[{shotId,passed,styleCompliant,subjectMatches,historicallyPlausible,readable,issues:[string]}]}.`,schema);
  reviews.push(...result.reviews);
 }
 return doodleSetQA.parse({passed:reviews.length===shots.length&&reviews.length>0&&reviews.every(r=>r.passed&&r.styleCompliant&&r.subjectMatches&&r.historicallyPlausible&&r.readable&&!r.issues.length),reviews,method:'actual-image Gemini review'});
}
