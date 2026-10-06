import {z} from 'zod';
import {script} from '../orchestration/schemas';
import type {LLMProvider} from '../providers/interfaces';
import {scriptQuality} from '../longform';
export const qualityScript=script.superRefine((value,ctx)=>{
 const text=value.scenes.map(s=>s.narration).join(' '),count=text.trim().split(/\s+/).length;
 if(count<190||count>210)ctx.addIssue({code:'custom',message:`Narration has ${count} words; required 190-210, excluding title/hook/visual descriptions`});
 if(value.scenes.length!==4||value.scenes.some((s,i)=>s.id!==`scene-${i+1}`))ctx.addIssue({code:'custom',message:'Exactly four ordered scenes scene-1 through scene-4 required'});
 if(/quality test|render(?:ing)?|fidelity|ambient occlusion|surface diffusion|shadow casting|digital model|material sorting|camera|workflow|pipeline/i.test(text))ctx.addIssue({code:'custom',message:'Narration must tell a human historical story, not describe production technology or a test'});
 if(!/imagined reconstruction/i.test(text))ctx.addIssue({code:'custom',message:'Narration must disclose this imagined reconstruction'});
 if(value.scenes.some(s=>s.claims.length))ctx.addIssue({code:'custom',message:'This fictional test must not add event-specific empirical claims'});
 const review=scriptQuality(value.scenes.map(s=>s.narration));if(!review.passed)ctx.addIssue({code:'custom',message:`Narrative repetition/cliche gate failed: score ${review.score}, duplicate sentences ${review.repeatedSentences}, repeated phrases ${review.repeatedTwelveWordPhrases}`});
});
export async function createQualityScript(llm:LLMProvider){
 let correction='';
 for(let attempt=0;attempt<3;attempt++)try{return qualityScript.parse(await llm.json(`Write an original English cinematic historical micro-story, not a description of a software test. Follow an imagined merchant from a Mediterranean harbor at dawn through a stone courtyard, papyrus workshop and market around 200 BCE. Use vivid plain everyday English and human stakes; no named real people, documented events, quotations or empirical claims. Narration is 190-210 words TOTAL (aim exactly 200), four scenes with IDs scene-1..scene-4, around 50 spoken words per scene. Title/hook/visuals are excluded from this count. Say "imagined reconstruction" once in the narration. Begin directly with an intriguing story beat; no welcome, no long intro, no "visual quality test". Never mention rendering, camera, simulation, surface diffusion, workflow or production technology in narration. Use short clear sentences with familiar words. Prefer boats, dock, dark ink and record over moored hulls, quay, soot ink and log; these phrases caused ambiguous pronunciation in the CPU narrator test. Avoid rare technical nouns, hyphenated compounds and spoken numbers. Visual descriptions may contain camera direction. Return {title,topic,hook,scenes:[{id,narration,visual,claims:[]}]}. Do not pad by repeating sentences. ${correction}`,qualityScript));}catch(e){if(!(e instanceof z.ZodError))throw e;correction=`Previous output violated these gates; rewrite it fully: ${e.issues.map(i=>i.message).join('; ')}`;if(attempt===2)throw e;}
 throw new Error('Quality script validation failed');
}
