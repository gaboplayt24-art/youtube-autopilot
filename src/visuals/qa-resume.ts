import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {read,json} from '../orchestration/io';
const policyVersion='labelled-style-period-and-shot-roles-v2';
export async function nextSourceRevision(root:string,id:string,current:number){
 const folders=await readdir(join(root,id)).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return [];throw error;});
 return Math.max(current,0,...folders.filter(name=>/^revision-\d+$/.test(name)).map(name=>Number(name.slice(9))))+1;
}
export async function migrateVisualQAState(dir:string,root:string,state:Record<string,{revision:number;direction:string}>){
 const marker=join(dir,'visual-QA-policy.json');try{if((await read(marker)).version===policyVersion)return state;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 let reviews:{sourceImageId:string;subjectMatches:boolean;actionMatches:boolean;framingMatches:boolean;identityMatches:boolean|null}[]=[];
 try{reviews=z.object({reviews:z.array(z.object({sourceImageId:z.string(),subjectMatches:z.boolean(),actionMatches:z.boolean(),framingMatches:z.boolean(),identityMatches:z.boolean().nullable()}))}).parse(await read(join(dir,'shot-content-QA.json'))).reviews;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const restoredOriginals:string[]=[],pendingReset:string[]=[];
 for(const [id,value]of Object.entries(state)){
  const prior=reviews.find(review=>review.sourceImageId===id);
  if(prior&&prior.subjectMatches&&prior.actionMatches&&prior.framingMatches&&prior.identityMatches!==false){delete state[id];restoredOriginals.push(id);continue;}
  try{await read(join(root,id,`revision-${value.revision}`,'source.json'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;delete state[id];pendingReset.push(id);}
 }
 await json(join(dir,'visual-generation-state.json'),state);await json(marker,{version:policyVersion,restoredOriginals,pendingReset,preservedAllRawGenerations:true,reason:'Whole-set style review must not replace supporting workers/officials with the merchant; incomplete replacements are re-audited from their available source.'});return state;
}
