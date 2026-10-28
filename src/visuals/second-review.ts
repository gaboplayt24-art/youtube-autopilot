// Owner-approved 2026-10-28 ("avanza"): a second free reviewer, Qwen on Groq, asks three objective questions of an
// image Gemini already accepted. Audition evidence (bible-noah-003): it caught an unrequested second character, a
// floating extra brush and a missing goat pen that Gemini passed, but invented "three-panel collage" layouts, so it
// is never asked about layout (dimensions are measured in code). It can only add a rejection, never accept.
import {z} from 'zod';
import {visionImage} from './style-reference-v4';
import type {VisionProvider} from '../providers/interfaces';
import type {ArtworkIdea} from './illustration-schema';
export const secondReview=z.object({distinctPeople:z.number().int().min(0),unrequestedPeople:z.boolean(),missingRequiredObjects:z.array(z.string().max(120)).max(6),fusedOrDuplicatedBodies:z.boolean(),detail:z.string().max(600)});
export type SecondReview=z.infer<typeof secondReview>;
export function secondReviewPrompt(idea:ArtworkIdea){
 const cast=idea.characterRoles.length?idea.characterRoles.join(', '):'none named (Eli, the recurring bearded character in a striped head cloth, may appear alone)';
 return `Inspect ONLY this illustration. Answer three objective questions and ignore style, layout, borders and image size.
1. Count the distinct human or human-like figures. The requested cast is: ${cast}. unrequestedPeople is true only if the image shows a person who is clearly not one of the requested roles (a background crowd counts only if the concept asks for none).
2. List physical objects the concept explicitly requires that are NOT visible at all (empty list if all are present; do not list abstract ideas or text).
3. fusedOrDuplicatedBodies is true if any person or animal has an extra head, merged bodies, a duplicated limb or an object fused into a body.
Concept: ${JSON.stringify(idea.concept)}
Return {distinctPeople,unrequestedPeople,missingRequiredObjects,fusedOrDuplicatedBodies,detail}.`;
}
export async function runSecondReview(path:string,idea:ArtworkIdea,vision:VisionProvider){return secondReview.parse(await vision.images(secondReviewPrompt(idea),[await visionImage(path)],secondReview));}
/** Objective failures added to an accepted Gemini review; the original verdict stays recorded beside it. */
export function applySecondReview<R extends {passed:boolean;objectiveFailures?:string[];issues:string[]}>(review:R,second:SecondReview):R{
 const failures=[...(second.unrequestedPeople?['secondReviewUnrequestedPeople']:[]),...(second.missingRequiredObjects.length?['secondReviewMissingObject']:[]),...(second.fusedOrDuplicatedBodies?['secondReviewFusedBody']:[])];
 if(!failures.length)return review;
 return {...review,passed:false,objectiveFailures:[...(review.objectiveFailures??[]),...failures],issues:[...review.issues,'Second reviewer (Qwen on Groq): '+second.detail+(second.missingRequiredObjects.length?' Missing: '+second.missingRequiredObjects.join(', '):'')]};
}
