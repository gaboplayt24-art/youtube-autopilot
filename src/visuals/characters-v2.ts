import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {json,read} from '../orchestration/io';
import type {VisualBible} from './bible';
import type {ImageProvider,LLMProvider,VisionProvider} from '../providers/interfaces';
import {loadStyleLock,lockedPrompt} from './style-lock';
import {contactSheet,generateSource} from './illustrated';
export const characterPack=z.object({characterId:z.string(),assets:z.array(z.object({id:z.string(),path:z.string(),sha256:z.string()})),source:z.literal('canonical-character-pack'),reused:z.boolean(),hiddenReferences:z.boolean(),qaPassed:z.boolean(),limitation:z.string()});
export type CharacterPack=z.infer<typeof characterPack>;
const identityReview=z.object({passed:z.boolean(),samePerson:z.boolean(),sameAge:z.boolean(),sameHairstyle:z.boolean(),sameFacialStructure:z.boolean(),sameCostume:z.boolean(),sameBodyProportions:z.boolean(),outliers:z.array(z.object({id:z.string(),reason:z.string(),repairDirection:z.string().max(160)})),review:z.string()});
export async function createCharacterReferencePack(character:{id:string;identity:string;costume:string;props:string[];era:string;continuityRules:string[];identityFields?:unknown},bible:VisualBible,dir:string,image:ImageProvider,reviewer:LLMProvider&VisionProvider,prepareOnly=false):Promise<CharacterPack>{
 const style=await loadStyleLock(),folder=join(dir,'characters',character.id);await mkdir(folder,{recursive:true});
 const identity=`${character.identity}; ${character.costume}; ${character.continuityRules.join('; ')}`;
 const poses=[['A','85mm near-front portrait, head and shoulders, plain warm limestone behind'],['B','85mm three-quarter portrait turned left, head and shoulders, plain warm limestone behind'],['C','85mm strict side profile facing right, plain warm limestone behind'],['D','35mm full body standing, feet visible, natural proportions, plain limestone courtyard'],['E','35mm three-quarter full body, reaching to inspect a clay jar, plain limestone courtyard']];
 const prompts=poses.map(([id,pose])=>({id,prompt:lockedPrompt(style,bible,pose,identity)}));
 const checked=await reviewer.json(`Before FLUX review every canonical identity prompt for era, materials, clothing, hairstyle and style-lock conflicts. No prompt rewriting. Return {passed,issues:[string]}. Bible ${JSON.stringify(bible)} Registry ${JSON.stringify(character)} Prompts ${JSON.stringify(prompts)}`,z.object({passed:z.boolean(),issues:z.array(z.string())}));
 await json(join(folder,'prompt-review.json'),{...checked,prompts});if(!checked.passed)throw new Error('Canonical prompt preflight rejected');
 const base={characterId:character.id,source:'canonical-character-pack' as const,reused:false,hiddenReferences:true,qaPassed:false,limitation:'FLUX Schnell REST is text-to-image, without reference-image conditioning. Detailed shared identity plus actual cross-view Gemini QA is used; identity is not guaranteed by prompts alone.'};
 if(prepareOnly)return {...base,assets:[]};
 const stateSchema=z.record(z.object({revision:z.number().int().nonnegative(),direction:z.string()}));let state:z.infer<typeof stateSchema>={};
 try{state=stateSchema.parse(await read(join(folder,'generation-state.json')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let frames=[];
 for(let round=0;round<=style.qualityTest.repairRounds;round++){
  frames=[];for(const [id,pose]of poses){const s=state[id]??{revision:0,direction:''};const prompt=lockedPrompt(style,bible,pose+(s.direction?'; correction: '+s.direction:''),identity);frames.push(await generateSource(id,prompt,pose,true,folder,s.revision,image));}
  const sheet=join(dir,'..','character-contact-sheet.jpg');await contactSheet(frames,sheet,5);
  const result=await reviewer.images(`Compare all FIVE independently generated canonical views. They MUST depict the SAME perceived person, age, exact hairstyle, facial structure, costume, proportions. They must share the locked painterly illustration technique. Image is labelled A front, B three-quarter, C profile, D full body, E contextual full body. Identify only incorrect views for regeneration by exact id; never accept identity drift just to complete rendering. Return {passed,samePerson,sameAge,sameHairstyle,sameFacialStructure,sameCostume,sameBodyProportions,outliers:[{id,reason,repairDirection}],review}. Registry ${JSON.stringify(character)} Style ${JSON.stringify(style)}`,[{mimeType:'image/jpeg',data:(await readFile(sheet)).toString('base64')}],identityReview);
  await json(join(folder,`identity-QA-round-${round}.json`),result);await json(join(dir,'..','character-identity-QA.json'),{...result,round,hiddenReferences:true,limitation:base.limitation});
  if(result.passed&&[result.samePerson,result.sameAge,result.sameHairstyle,result.sameFacialStructure,result.sameCostume,result.sameBodyProportions].every(Boolean)&&!result.outliers.length)return characterPack.parse({...base,qaPassed:true,assets:frames.map(({id,path,sha256})=>({id,path,sha256}))});
  if(!result.outliers.length||result.outliers.some(o=>!poses.some(([id])=>id===o.id)))throw new Error('Canonical identity failure lacks valid actionable outliers');
  if(round===style.qualityTest.repairRounds)break;
  const repairs=result.outliers.map(o=>{state[o.id]={revision:(state[o.id]?.revision??0)+1,direction:o.repairDirection};return {id:o.id,prompt:lockedPrompt(style,bible,poses.find(([id])=>id===o.id)![1]+'; correction: '+o.repairDirection,identity)};});
  const checked=await reviewer.json('Review ONLY these corrected final identity prompts for historical/style conflicts before FLUX. Return {passed,issues}. '+JSON.stringify({bible,repairs}),z.object({passed:z.boolean(),issues:z.array(z.string())}));if(!checked.passed)throw new Error('Canonical repair prompt rejected');await json(join(folder,'generation-state.json'),state);
 }
 throw new Error('Canonical identity still inconsistent after selective repairs; scene generation blocked');
}
