import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {validatedJSON} from '../providers/validated-json';
import {json,read,exec} from '../orchestration/io';
import type {VisualBible} from './bible';
import type {ImageProvider,LLMProvider,VisionProvider} from '../providers/interfaces';
import {loadStyleLock,lockedPrompt} from './style-lock';
import {contactSheet,generateSource,type SourceFrame} from './illustrated';
export const characterPack=z.object({characterId:z.string(),assets:z.array(z.object({id:z.string(),path:z.string(),sha256:z.string()})),source:z.literal('canonical-character-pack'),reused:z.boolean(),hiddenReferences:z.boolean(),qaPassed:z.boolean(),limitation:z.string()});
export type CharacterPack=z.infer<typeof characterPack>;
const identityReview=z.object({passed:z.boolean(),samePerson:z.boolean(),sameAge:z.boolean(),sameHairstyle:z.boolean(),sameFacialStructure:z.boolean(),sameCostume:z.boolean(),sameBodyProportions:z.boolean(),views:z.array(z.object({id:z.enum(['A','B','C','D','E']),poseCorrect:z.boolean(),identityCorrect:z.boolean(),costumeCorrect:z.boolean(),styleCorrect:z.boolean()})).length(5),outliers:z.array(z.object({id:z.string(),reason:z.string(),repairDirection:z.string().max(1200)})),review:z.string()});
export async function createCharacterReferencePack(character:{id:string;identity:string;costume:string;props:string[];era:string;continuityRules:string[];identityFields?:unknown},bible:VisualBible,dir:string,image:ImageProvider,reviewer:LLMProvider&VisionProvider,prepareOnly=false):Promise<CharacterPack>{
 const style=await loadStyleLock(),folder=join(dir,'characters-reference-conditioned',character.id);await mkdir(folder,{recursive:true});
 const identity=`${character.identity}; ${character.costume}; ${character.continuityRules.join('; ')}`;
 const poses=[['A','85mm near-front portrait, head and shoulders, plain warm limestone behind, no props, no harbor'],['B','85mm three-quarter portrait turned left, head and shoulders, plain warm limestone behind'],['C','85mm strict side profile facing right, plain warm limestone behind'],['D','35mm full body standing, feet visible, natural proportions, plain limestone courtyard, no harbor'],['E','35mm three-quarter full body, reaching to inspect a clay jar, plain limestone courtyard']];
 const prompts=poses.map(([id,pose])=>({id,prompt:lockedPrompt(style,bible,pose,identity)}));
 const checked=await validatedJSON(reviewer,`Before FLUX review every canonical identity prompt for era, materials, clothing, hairstyle and style-lock conflicts. No prompt rewriting. Return {passed,issues:[string]}. Bible ${JSON.stringify(bible)} Registry ${JSON.stringify(character)} Prompts ${JSON.stringify(prompts)}`,z.object({passed:z.boolean(),issues:z.array(z.string())}));
 await json(join(folder,'prompt-review.json'),{...checked,prompts});if(!checked.passed)throw new Error('Canonical prompt preflight rejected');
 const base={characterId:character.id,source:'canonical-character-pack' as const,reused:false,hiddenReferences:true,qaPassed:false,limitation:'FLUX.2 Klein 4B uses actual canonical A as image conditioning for B..E; five independently generated outputs still require strict cross-view Gemini QA.'};
 if(prepareOnly)return {...base,assets:[]};
 const stateSchema=z.record(z.object({revision:z.number().int().nonnegative(),direction:z.string()}));let state:z.infer<typeof stateSchema>={};
 try{state=stateSchema.parse(await read(join(folder,'generation-state.json')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let frames:SourceFrame[]=[];
 for(let round=0;round<=style.qualityTest.repairRounds;round++){
  const canonicalPrompt=(pose:string,direction:string)=>lockedPrompt(style,{...bible,regionalArchitecture:'plain limestone wall',boats:'none visible',technology:'none visible'},'Same woman as image 0; change camera only: '+pose+'; correction: '+direction,identity);
  frames=[];for(const [id,pose]of poses){const s=state[id]??{revision:0,direction:''};const prompt=s.revision?canonicalPrompt(pose,s.direction):lockedPrompt(style,bible,pose,identity);frames.push(await generateSource(id,prompt,pose,true,folder,s.revision,image,id==='A'?[]:[frames[0].path]));}
  const sheet=join(dir,'..','character-contact-sheet.jpg');await contactSheet(frames,sheet,5);
  const evidence=[{mimeType:'image/jpeg',data:(await readFile(sheet)).toString('base64')}];
  for(const frame of frames){const path=frame.path+'.identity-review.jpg';await exec('ffmpeg',['-y','-v','error','-i',frame.path,'-vf','scale=768:-2','-frames:v','1',path],{timeout:20000});evidence.push({mimeType:'image/jpeg',data:(await readFile(path)).toString('base64')});}
  const result=await validatedJSON({json:<T>(instruction:string,schema:z.ZodType<T>)=>reviewer.images(instruction,evidence,schema)},`Compare all FIVE independently generated canonical views. They MUST depict the SAME perceived person, age, exact hairstyle, facial structure, costume, proportions. They must share the locked painterly illustration technique. First image is the contact sheet; next FIVE images are readable individual views in A..E order. Images are labelled A front, B three-quarter, C profile, D full body, E contextual full body. Also enforce framing: A head-and-shoulders near-front, B head-and-shoulders three-quarter, C strict side profile, D full body feet visible, E contextual full body feet visible. Reject wrong poses and unwanted jewelry/makeup/modern markings. Identify only incorrect views for regeneration by exact id; never accept identity drift just to complete rendering. For EACH labelled view explicitly check poseCorrect, identityCorrect, costumeCorrect, styleCorrect. B cannot be full body; C must have one eye visible and the nose in strict profile. Every incorrect view must be an outlier even if identity is consistent. Return {passed,samePerson,sameAge,sameHairstyle,sameFacialStructure,sameCostume,sameBodyProportions,views:[{id,poseCorrect,identityCorrect,costumeCorrect,styleCorrect}],outliers:[{id,reason,repairDirection}],review}. Registry ${JSON.stringify(character)} Style ${JSON.stringify(style)}`,identityReview);
  await json(join(folder,`identity-QA-round-${round}.json`),result);await json(join(dir,'..','character-identity-QA.json'),{...result,round,hiddenReferences:true,limitation:base.limitation});
  if(new Set(result.views.map(v=>v.id)).size!==5)throw new Error('Canonical QA omitted a view');
  if(result.views.some(v=>![v.poseCorrect,v.identityCorrect,v.costumeCorrect,v.styleCorrect].every(Boolean)&&!result.outliers.some(o=>o.id===v.id)))throw new Error('Canonical QA omitted an incorrect view from outliers');
  if(result.passed&&result.views.every(v=>[v.poseCorrect,v.identityCorrect,v.costumeCorrect,v.styleCorrect].every(Boolean))&&[result.samePerson,result.sameAge,result.sameHairstyle,result.sameFacialStructure,result.sameCostume,result.sameBodyProportions].every(Boolean)&&!result.outliers.length)return characterPack.parse({...base,qaPassed:true,assets:frames.map(({id,path,sha256})=>({id,path,sha256}))});
  if(!result.outliers.length||result.outliers.some(o=>!poses.some(([id])=>id===o.id)))throw new Error('Canonical identity failure lacks valid actionable outliers');
  if(round===style.qualityTest.repairRounds)break;
  const concise=await validatedJSON(reviewer,'Condense each repair into <=100 characters without dropping the main identity/pose correction. Return {repairs:[{id,direction}]}. '+JSON.stringify(result.outliers),z.object({repairs:z.array(z.object({id:z.string(),direction:z.string().max(100)}))}));if(concise.repairs.length!==result.outliers.length||result.outliers.some(o=>!concise.repairs.some(r=>r.id===o.id)))throw new Error('Repair directions omitted an outlier');
  const repairs=result.outliers.map(original=>{const o={...original,repairDirection:concise.repairs.find(r=>r.id===original.id)!.direction};state[o.id]={revision:(state[o.id]?.revision??0)+1,direction:o.repairDirection};return {id:o.id,prompt:canonicalPrompt(poses.find(([id])=>id===o.id)![1],o.repairDirection)};});
  const checked=await validatedJSON(reviewer,'Review ONLY these corrected final identity prompts for historical/style conflicts before FLUX. Return {passed,issues}. '+JSON.stringify({bible,repairs}),z.object({passed:z.boolean(),issues:z.array(z.string())}));if(!checked.passed)throw new Error('Canonical repair prompt rejected');await json(join(folder,'generation-state.json'),state);
 }
 throw new Error('Canonical identity still inconsistent after selective repairs; scene generation blocked');
}
