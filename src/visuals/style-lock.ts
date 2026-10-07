import {z} from 'zod';
import {read} from '../orchestration/io';
import type {VisualBible} from './bible';
export const styleLock=z.object({version:z.string(),medium:z.string(),renderingTechnique:z.string(),characterRendering:z.string(),skinRendering:z.string(),facialDetail:z.string(),backgroundRendering:z.string(),texture:z.string(),lineQuality:z.string(),light:z.string(),colorPalette:z.array(z.string()),contrast:z.string(),depth:z.string(),cameraLanguage:z.string(),filmGrainTreatment:z.string(),historicalRealism:z.string(),stylizationLevel:z.string(),prefix:z.string().min(100),negativeRules:z.array(z.string()).min(15),qualityTest:z.object({hookBeatSeconds:z.number().min(2).max(4).default(2.4),bodyBeatSeconds:z.number().min(3).max(6).default(3.8),shotsMin:z.number(),shotsMax:z.number(),uniqueMin:z.number(),uniqueMax:z.number(),uniqueSourceRatioMin:z.number(),maxSourceUses:z.number(),maxSourceDurationFraction:z.number(),repairRounds:z.number().int().min(0).max(3)})});
export type StyleLock=z.infer<typeof styleLock>;
export async function loadStyleLock(){return styleLock.parse(await read('config/style-lock.json'));}
export function lockedPrompt(style:StyleLock,bible:VisualBible,concept:string,identity?:string){
 const prompt=`${style.prefix} Priority shot: ${concept}. ${identity?`Identity: ${identity}.`:''} Setting: ${bible.era}, ${bible.century}, ${bible.civilization}, ${bible.location}. If visible: ${bible.regionalArchitecture}; ${bible.materials}; ${bible.clothing}; ${bible.boats}; ${bible.technology}. Center-safe illustration. ${style.negativeRules.join('; ')}. Exclude ${bible.forbiddenAnachronisms.join(', ')}.`;
 if(prompt.length>2048)throw new Error('Locked FLUX prompt exceeds 2048 characters; shorten concept/identity, never truncate style or negatives');
 return prompt;
}
