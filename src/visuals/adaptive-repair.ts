import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {ArtworkIdea} from './illustration-schema';
import type {IllustratedStyleLock} from './illustration-schema';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import type {Runner} from '../orchestration/runner';
import {visionImage} from './style-reference-v4';
import {validatedJSON} from '../providers/validated-json';
type Reviewed={source:{path:string;sha256:string};review:{passed:boolean;objectiveFailures?:string[];issues:string[]};artwork?:unknown};
/** No acceptance override: each correction must pass the original generator's full objective review. */
const PROMPT_QA=/^Native prompt QA failed before asset spending: \S+ (.*)$/s;
/** No acceptance override: each correction must pass the original generator's full objective review.
 * A correction refused by prompt QA before any drawing is fed back to the planner instead of ending the episode. */
export async function repairUntilReviewed<T extends Reviewed>(initial:T,plan:(last:T,promptIssues?:string[])=>Promise<ArtworkIdea>,generate:(idea:ArtworkIdea)=>Promise<T>){
 let result=initial,promptIssues:string[]|undefined;const seen=new Set<string>();
 while(!result.review.passed||!result.artwork){
  const idea=await plan(result,promptIssues),identity=createHash('sha256').update(idea.concept.trim().toLowerCase()).digest('hex');
  if(seen.has(identity))throw Error('Adaptive correction repeated an unsuccessful concept; preserve evidence instead of blind regeneration');
  seen.add(identity);
  try{result=await generate(idea);promptIssues=undefined;}
  catch(error){const match=(error as Error).message.match(PROMPT_QA);if(!match)throw error;let issues:unknown;try{issues=JSON.parse(match[1]);}catch{issues=[match[1]];}promptIssues=z.array(z.string()).parse(issues);}
 }
 return result;
}
/** A planner-invented, unnamed cast (e.g. "Modern Reader") may be dropped only when the narration names none of it. */
export function peopleOptional(original:ArtworkIdea){
 const narration=original.narration.toLowerCase();
 return original.characterRoles.length>0&&original.characterRoles.every(role=>!role.toLowerCase().split(/[^a-z]+/).some(w=>w.length>3&&narration.includes(w)));
}
export async function planVisualCorrection(original:ArtworkIdea,last:Reviewed,style:IllustratedStyleLock,reference:string,runner:Runner,vision:LLMProvider&VisionProvider,promptIssues?:string[]){
 const optional=peopleOptional(original);
 const schema=z.object({concept:z.string().min(30).max(420),correctionReason:z.string().min(10).max(500),withoutPeople:z.boolean().optional()}).strict();
 const evidence=createHash('sha256').update(JSON.stringify(promptIssues?{source:last.source.sha256,failures:last.review,original,promptIssues}:{source:last.source.sha256,failures:last.review,original})).digest('hex').slice(0,16);
 const plan=await runner.stage('native-'+original.id+'-adaptive-plan-'+evidence,schema,async()=>{
  const images=[await visionImage(reference),await visionImage(last.source.path)];
  return validatedJSON({json:<T>(prompt:string,contract:z.ZodType<T>)=>vision.images(prompt,images,contract)},`Correct this ACTUAL rejected illustration. Image1 is the approved style reference; image2 is the rejected source. Return {concept:30-420 characters,correctionReason:10-500 characters}. Change visual construction to fix the recorded defects, never waive them. Preserve the original narrated meaning, exact factual numbers, source-bound visionary anatomy, requested cast, era/material constraints and style. Do not add facts, text, labels, arrows, code geometry or photorealism. No cosmetic score manipulation. Use positive concrete instructions and a simpler composition when necessary. Style: ${JSON.stringify({prefix:style.prefix})}. Immutable original: ${JSON.stringify(original)}. Actual rejection: ${JSON.stringify(last.review)}. A book inset must also be a flat-colour cartoon, never a detailed shaded engraving. The concept must agree with the immutable historicalContext and characterRoles; never mix ancient dress into a modern setting or the reverse.${promptIssues?` Your previous correction was refused before drawing for: ${JSON.stringify(promptIssues)}. Resolve these conflicts.`:''}${optional?' The narration names none of the requested cast, so if that cast conflicts with the style or era you may set withoutPeople:true and convey the narrated idea through objects only (no people, no lettering).':''}`,schema);
 });
 if(plan.concept.trim().toLowerCase()===original.concept.trim().toLowerCase())throw Error('Correction did not change the rejected concept');
 const withoutPeople=optional&&plan.withoutPeople===true;
 return {...original,id:original.id+'-auto-'+createHash('sha256').update(plan.concept+(withoutPeople?'|no-people':'')).digest('hex').slice(0,12),concept:plan.concept,promptFocus:true,...(withoutPeople?{characterRoles:[]}:{})};
}
