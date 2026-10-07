import {styleLock,type StyleLock} from './style-lock-schema';
export {styleLock,type StyleLock} from './style-lock-schema';
import {read} from '../orchestration/io';
import type {VisualBible} from './bible';
export async function loadStyleLock(){return styleLock.parse(await read('config/style-lock-v4.json'));}
export function lockedPrompt(style:StyleLock,bible:VisualBible,concept:string,identity?:string){
 const prompt=`${style.prefix} Priority shot: ${concept}. ${identity?`Identity: ${identity}.`:''} Setting: ${bible.era}, ${bible.century}, ${bible.civilization}, ${bible.location}. If visible: ${bible.regionalArchitecture}; ${bible.materials}; ${bible.clothing}; ${bible.boats}; ${bible.technology}. Center-safe illustration. ${style.negativeRules.join('; ')}. Exclude ${bible.forbiddenAnachronisms.join(', ')}.`;
 if(prompt.length>2048)throw new Error('Locked FLUX prompt exceeds 2048 characters; shorten concept/identity, never truncate style or negatives');
 return prompt;
}
