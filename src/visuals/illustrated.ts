import {mkdir,readFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {json,read,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import type {ImageProvider,LLMProvider,VisionProvider} from '../providers/interfaces';
import type {Shot,MediaAsset} from '../editor/schemas';
import type {VisualBible} from './bible';
import {lockedPrompt,type StyleLock} from './style-lock';
import {currentCosts} from '../cost';
import {estimateDepth} from './depth';

const id=z.string().regex(/^[A-Za-z0-9_-]+$/);
export const sourceFrame=z.object({id,path:z.string(),sha256:z.string().length(64),prompt:z.string(),concept:z.string(),character:z.boolean(),revision:z.number().int().nonnegative()});
export type SourceFrame=z.infer<typeof sourceFrame>;
export const storyboard=z.object({sources:z.array(z.object({id,concept:z.string().min(10).max(260),character:z.boolean(),momentId:id})).min(24).max(30),beats:z.array(z.object({shotId:id,sourceImageId:id,editorialVariant:z.enum(['wide','detail-left','detail-right']),reuseReason:z.string().nullable()})).min(30).max(34),thumbnailTexts:z.array(z.string().min(1).max(28).refine(s=>s.split(/\s+/).length<=5)).length(3),reuseReview:z.object({passed:z.boolean(),issues:z.array(z.string())}).optional()});
export type Storyboard=z.infer<typeof storyboard>;
export function validateStoryboard(value:Storyboard,shots:Shot[],style:StyleLock){
 if(value.beats.length!==shots.length||value.beats.some((b,i)=>b.shotId!==shots[i].id))throw new Error('Storyboard changed speech-timed shot order');
 if(new Set(value.sources.map(s=>s.id)).size!==value.sources.length)throw new Error('Duplicate source IDs');
 const uses=new Map<string,typeof value.beats>();
 for(const [i,beat]of value.beats.entries()){
  if(!value.sources.some(s=>s.id===beat.sourceImageId))throw new Error('Storyboard references missing source');
  if(i&&value.beats[i-1].sourceImageId===beat.sourceImageId)throw new Error('Consecutive source reuse forbidden');
  uses.set(beat.sourceImageId,[...(uses.get(beat.sourceImageId)??[]),beat]);
 }
 if(uses.size!==value.sources.length||uses.size/shots.length<style.qualityTest.uniqueSourceRatioMin)throw new Error('Insufficient unique generated sources');
 for(const list of uses.values())if(list.length>style.qualityTest.maxSourceUses||list.length>1&&(!list.every(b=>b.reuseReason&&b.reuseReason.length>15)||new Set(list.map(b=>b.editorialVariant)).size!==list.length))throw new Error('Reuse needs same exact visual moment, explicit reason and materially different framing');
 return {...value,sources:[...value.sources].sort((a,b)=>value.beats.findIndex(s=>s.sourceImageId===a.id)-value.beats.findIndex(s=>s.sourceImageId===b.id))};
}
export async function planIllustratedBeats(shots:Shot[],context:unknown,style:StyleLock,llm:LLMProvider){
 let correction='';for(let attempt=0;attempt<3;attempt++){
  try{
  const value=await llm.json(`Plan unique keyframes for EVERY exact speech-timed beat. Return {sources:[{id,concept,character,momentId}],beats:[{shotId,sourceImageId,editorialVariant,reuseReason}],thumbnailTexts:[3 hooks<=5 words,<=28 chars]}. Target 30 distinct generated sources for ${shots.length} beats (24-30 allowed, ratio>=.75). Never reuse a source consecutively. Max TWO uses of any source, and reuse ONLY if both narrations describe the same EXACT visual moment; explain both reuseReasons and editorialVariant must be EXACTLY one of wide, detail-left, detail-right. Never use portrait, medium, closeup or any other value. Use materially different framing. Otherwise create a unique source. No fixed per-scene quota. Each concept <=260 chars: specific subject, action, period details and 24/35/50/85mm framing. Variety: architecture, objects, daily life, ships, rooms, crowds, food, hands, workshops. character:true ONLY when this particular action benefits from the recurring merchant; do not alternate generic portraits by index. All frames inherit locked illustration style; never invent art directions, style words, modern writing, numbers, brands or sources. Merchant has consistent identity supplied by registry. Keep supplied shotIds and order exactly. Context ${JSON.stringify(context)}. Style ${JSON.stringify(style)}. Beats ${JSON.stringify(shots.map(s=>({id:s.id,sceneId:s.sceneId,narration:s.narration,start:s.start,end:s.end})))}. ${correction}`,storyboard);
   const chronological=validateStoryboard(value,shots,style);
   const repeated=value.sources.map(s=>({source:s,beats:value.beats.map((b,i)=>({...b,narration:shots[i].narration})).filter(b=>b.sourceImageId===s.id)})).filter(s=>s.beats.length>1);
   const reuseReview=await llm.json('Review explicitly reused sources against their two narration beats and full context. Allowed ONLY for the same EXACT visual moment, not merely the same location/person/topic. Framing must be materially different. Return {passed,issues:[string]}. '+JSON.stringify({context,repeated}),z.object({passed:z.boolean(),issues:z.array(z.string())}));
   if(!reuseReview.passed)throw new Error('Same-moment reuse rejected: '+reuseReview.issues.join('; '));
   return storyboard.parse({...chronological,reuseReview});
  }catch(e){if(attempt===2)throw e;const detail=e instanceof z.ZodError?[...new Set(e.issues.map(i=>i.message))].join('; '):(e as Error).message;correction=`Fix structural/schema/editorial rejection without relaxing constraints: ${detail}`;}
 }throw new Error('Storyboard rejected');
}
export async function contactSheet(frames:{id:string;path:string}[],path:string,columns=6){
 if(!frames.length)throw new Error('Contact sheet requires actual images');const folder=path+'.frames';await mkdir(folder,{recursive:true});
 for(const [i,frame]of frames.entries()){
  if(!/^[A-Za-z0-9_-]+$/.test(frame.id))throw new Error('Unsafe contact sheet label');
  await exec('ffmpeg',['-y','-v','error','-i',frame.path,'-vf',`scale=320:180:force_original_aspect_ratio=decrease,pad=320:206:(ow-iw)/2:0:color=0x191817,drawtext=text='${frame.id}':x=8:y=185:fontsize=14:fontcolor=white`,'-frames:v','1',join(folder,String(i).padStart(3,'0')+'.jpg')],{timeout:20000});
 }
 await exec('ffmpeg',['-y','-v','error','-framerate','1','-i',join(folder,'%03d.jpg'),'-vf',`tile=${columns}x${Math.ceil(frames.length/columns)}:padding=4:margin=4:color=0x191817`,'-frames:v','1','-q:v','2',path],{timeout:30000});
}
export async function generateSource(id:string,prompt:string,concept:string,character:boolean,root:string,revision:number,image:ImageProvider):Promise<SourceFrame>{
 const folder=join(root,id,`revision-${revision}`);await mkdir(folder,{recursive:true});const path=join(folder,'source.png'),checkpoint=join(folder,'source.json');
 try{const previous=sourceFrame.parse(await read(checkpoint));if(previous.prompt!==prompt||previous.sha256!==await fileDigest(path))throw new Error('Source checkpoint integrity mismatch');return previous;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const costs=currentCosts();const generate=()=>image.generate(prompt,path);if(costs){if(costs.entries.length>=costs.policy.maxGeneratedImagesPerVideo)throw new Error('Generation cap reached; checkpoint retained');await costs.charge('generatedImages','cloudflare-flux-free',0,`${id}:revision-${revision}`,generate);}else await generate();
 const result=sourceFrame.parse({id,path,sha256:await fileDigest(path),prompt,concept,character,revision});await json(checkpoint,result);return result;
}
export const setReview=z.object({passed:z.boolean(),mediumConsistency:z.number().min(0).max(1),paletteConsistency:z.number().min(0).max(1),characterRendering:z.number().min(0).max(1),lighting:z.number().min(0).max(1),texture:z.number().min(0).max(1),stylization:z.number().min(0).max(1),historicalSetting:z.number().min(0).max(1),cameraLanguage:z.number().min(0).max(1),compositionSimilarity:z.number().min(0).max(1),characterPoseSimilarity:z.number().min(0).max(1),outliers:z.array(z.object({sourceImageId:id,reason:z.string(),repairDirection:z.string().max(180)})),review:z.string()});
export async function reviewIllustratedSet(frames:SourceFrame[],sheet:string,canonicalSheet:string,style:StyleLock,bible:VisualBible,registry:unknown,llm:VisionProvider){
 const images=[sheet,canonicalSheet];
 // The contact sheet evaluates the production as a SET; readable single frames
 // retain enough resolution to detect faces, modern labels and painterly technique.
 for(const frame of frames){const path=frame.path+'.review.jpg';await exec('ffmpeg',['-y','-v','error','-i',frame.path,'-vf','scale=512:-2','-frames:v','1',path],{timeout:20000});images.push(path);}
 const result=await llm.images(`Evaluate actual images as ONE coherent production: do these look like one illustrated historical series? Image1 chronological source contact sheet; image2 hidden canonical reference pack; remaining images ordered as manifest. Explicitly detect photographic/CGI outliers, different painting techniques/palettes, modern objects/typography, wrong subjects and recurring identity drift. Compare all character-bearing scene images against canonical design. STYLE inconsistency requires passed:false and affected sourceImageIds for selective regeneration, not a vague heuristic override. Minor beauty preferences may stay REVIEW. Return {passed,mediumConsistency,paletteConsistency,characterRendering,lighting,texture,stylization,historicalSetting,cameraLanguage,compositionSimilarity,characterPoseSimilarity,outliers:[{sourceImageId,reason,repairDirection}],review}. Scores0..1 are visual-model estimates, not measured pixel similarity. Include outliers for any major subject/history/identity defect. Style ${JSON.stringify(style)} Bible ${JSON.stringify(bible)} Registry ${JSON.stringify(registry)} Manifest ${JSON.stringify(frames.map(({id,concept,character})=>({id,concept,character})))}`,await Promise.all(images.map(async p=>({mimeType:'image/jpeg',data:(await readFile(p)).toString('base64')}))),setReview);
 if(result.outliers.some(o=>!frames.some(f=>f.id===o.sourceImageId)))throw new Error('Visual QA returned unknown source ID');
 if(!result.passed&&!result.outliers.length)throw new Error('Visual style failed without actionable outlier evidence');
 return result;
}
export const repetitionQA=z.object({passed:z.boolean(),uniqueSourceRatio:z.number(),uniqueGeneratedSources:z.number(),editorialBeatCount:z.number(),consecutiveDuplicateSources:z.number(),sourceReuseCounts:z.record(z.number()),maximumSourceDurationFraction:z.number(),perceptualSimilarity:z.array(z.object({a:z.string(),b:z.string(),similarity:z.number()})),characterPoseSimilarity:z.number().nullable(),compositionSimilarity:z.number().nullable(),issues:z.array(z.string()),method:z.string()});
export function sourceUsage(beats:Storyboard['beats'],shots:Shot[],hashes:Record<string,string>,style:StyleLock){
 const sourceReuseCounts:Record<string,number>={},hashUses:Record<string,number>={},seconds:Record<string,number>={};let consecutive=0;const issues=[];const total=shots.at(-1)?.end??0;
 beats.forEach((b,i)=>{const key=hashes[b.sourceImageId];if(!key)throw new Error('Missing source hash');sourceReuseCounts[b.sourceImageId]=(sourceReuseCounts[b.sourceImageId]??0)+1;hashUses[key]=(hashUses[key]??0)+1;seconds[key]=(seconds[key]??0)+shots[i].end-shots[i].start;if(i&&hashes[beats[i-1].sourceImageId]===key)consecutive++;});
 const unique=new Set(beats.map(b=>hashes[b.sourceImageId])).size,ratio=unique/beats.length,maxFraction=Math.max(...Object.values(seconds))/total;
 if(consecutive)issues.push('Consecutive duplicate generated sources');if(Object.values(hashUses).some(n=>n>style.qualityTest.maxSourceUses))issues.push('Source used more than twice');if(ratio<style.qualityTest.uniqueSourceRatioMin)issues.push('Unique source ratio below .75');if(maxFraction>style.qualityTest.maxSourceDurationFraction)issues.push('One source occupies excessive duration');
 return {uniqueSourceRatio:ratio,uniqueGeneratedSources:unique,editorialBeatCount:beats.length,consecutiveDuplicateSources:consecutive,sourceReuseCounts,maximumSourceDurationFraction:maxFraction,issues};
}
export async function inspectRepetition(board:Storyboard,shots:Shot[],frames:SourceFrame[],style:StyleLock,review:z.infer<typeof setReview>){
 const fingerprints=new Map<string,Buffer>();for(const f of frames){const {stdout}=await exec('ffmpeg',['-v','error','-i',f.path,'-vf','scale=9:8,format=gray','-frames:v','1','-f','rawvideo','-'],{encoding:'buffer',maxBuffer:100000,timeout:20000});fingerprints.set(f.id,stdout);}
 const perceptualSimilarity=[];for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++){const a=fingerprints.get(frames[i].id)!,b=fingerprints.get(frames[j].id)!;let matches=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((a[y*9+x]>a[y*9+x+1])===(b[y*9+x]>b[y*9+x+1]))matches++;if(matches/64>=.85)perceptualSimilarity.push({a:frames[i].id,b:frames[j].id,similarity:matches/64});}
 const usage=sourceUsage(board.beats,shots,Object.fromEntries(frames.map(f=>[f.id,f.sha256])),style);for(const pair of perceptualSimilarity)if(pair.similarity===1)usage.issues.push(`Identical perceptual fingerprint: ${pair.a}/${pair.b}; inspect/regenerate`);
 return repetitionQA.parse({...usage,passed:usage.issues.length===0,perceptualSimilarity,characterPoseSimilarity:review.characterPoseSimilarity,compositionSimilarity:review.compositionSimilarity,method:'Source SHA256 usage and durations; 64-bit grayscale dHash pairs >=.85. Pose/composition are Gemini set estimates; similar hashes alone do not prove duplicate images.'});
}
export async function sourceMedia(board:Storyboard,shots:Shot[],sources:SourceFrame[],root:string){
 const assets:MediaAsset[]=[];for(const [i,beat]of board.beats.entries()){
  const source=sources.find(s=>s.id===beat.sourceImageId)!;const folder=join(root,source.id,`revision-${source.revision}`,'depth');const depthLayers=await estimateDepth(source.path,folder);const path=join(root,shots[i].id+'.png');await copyFile(join(folder,'frame.png'),path);
  assets.push({shotId:shots[i].id,sourceImageId:source.id,sourceSha256:source.sha256,editorialVariant:beat.editorialVariant,path,kind:'image',provider:'cloudflare-flux-free',license:'FLUX.1 Schnell model Apache-2.0; AI illustration, Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,intent:source.concept,fallbacks:[],sha256:await fileDigest(path),depthLayers});
 }return {assets,estimatedTotalCost:0};
}
export function sourcePrompt(source:Storyboard['sources'][number],style:StyleLock,bible:VisualBible,identity:string,repair=''){return lockedPrompt(style,bible,`${source.concept}${repair?' Correction: '+repair:''}`,source.character?identity:undefined);}
