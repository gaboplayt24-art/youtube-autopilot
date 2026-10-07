import {z} from 'zod';
import type {Shot} from '../editor/schemas';
import type {VisionProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
import {visualIdea} from './thinking-schema';
import {validateIdeaEvidence} from './visual-thinking';
import style from '../../config/style-lock-v3.json';
export function inspectVisualIdeas(shots:Shot[]){
 const issues:string[]=[];if(!shots.length)issues.push('No educational shots');
 const signatures:string[]=[];
 for(const s of shots){const parsed=visualIdea.safeParse(s.visualIdea);if(!parsed.success){issues.push(s.id+': missing or invalid educational visual idea');continue;}
  try{validateIdeaEvidence(parsed.data,s.narration);}catch(e){issues.push(s.id+': '+(e as Error).message);}
  if(s.end<=s.start)issues.push(s.id+': invalid timing');
  const signature=JSON.stringify({type:parsed.data.conceptType,nodes:parsed.data.nodes,edges:parsed.data.relationships});
  if(signatures.at(-1)===signature)issues.push(s.id+': consecutive identical visual concept');signatures.push(signature);
 }
 return {passed:issues.length===0,issues,styleVersion:style.version,method:'Structural and numeric-evidence checks on original vector scene graph; not a semantic or multimodal image approval',humanApprovalRequired:true};
}
export async function reviewDoodleFrame(narration:string,image:{mimeType:string;data:string},vision:VisionProvider){
 const schema=z.object({passed:z.boolean(),styleCompliant:z.boolean(),subjectMatches:z.boolean(),historicallyPlausible:z.boolean(),unintendedWriting:z.boolean(),issues:z.array(z.string())});
 const result=await validatedJSON({json:<T>(instruction:string,s:z.ZodType<T>)=>vision.images(instruction,[image],s)},`Strictly review this actual frame for the NEW educational-doodle-v3 series. REQUIRE flat 2D, thick clear dark outlines, simple semi-stickman anatomy/minimal faces, cream/beige background, muted earth-tone palette, simple supportive environment, flat lighting and educational clarity. HARD REJECT photography, DSLR look, movie still, CGI/Unreal, detailed realistic skin, painterly classical realism, anime, superhero art, cinematic lighting/depth of field, clutter, modern objects/clothing/architecture, watermark/logo/random writing. The OLD painted historical contact sheet is NOT an acceptable target. Clean deliberate compositor labels supported by narration are allowed; random AI writing is not. Match the educational IDEA to narration, not a complex literal reconstruction. Supporting roles may differ from the recurring protagonist. Narration ${JSON.stringify(narration)}. Immutable art direction ${JSON.stringify(style)}. Return {passed,styleCompliant,subjectMatches,historicallyPlausible,unintendedWriting,issues}.`,schema);
 return {...result,passed:result.passed&&result.styleCompliant&&result.subjectMatches&&result.historicallyPlausible&&!result.unintendedWriting&&result.issues.length===0};
}
