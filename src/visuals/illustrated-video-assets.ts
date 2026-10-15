import {z} from 'zod';
import {KLEIN_PRODUCTION_SIZE} from '../providers/cloudflare';
import {join} from 'node:path';
import type {Shot} from '../editor/schemas';
import {media,componentCrop} from '../editor/schemas';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
import {visionImage} from './style-reference-v4';
import {VisualStyleEngine,fitNativeConcept} from './native-v4-2';
import {sourceBoundVision,type ArtworkIdea} from './illustration-schema';
import {Runner} from '../orchestration/runner';
import {read,log} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {createHash} from 'node:crypto';
/** Keep a saved component plan only while its exact reused beats are unchanged; a revised beat set gets a fresh, separately checkpointed plan. */
export async function componentReuseStage(dir:string,key:string,shotIds:string[]){const base='native-'+key+'-component-reuse';try{const saved=await read(join(dir,base+'.json')) as {uses?:{shotId:string}[]};const ids=(saved.uses??[]).map(u=>u.shotId).sort();if(JSON.stringify(ids)===JSON.stringify([...shotIds].sort()))return base;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return base;}return base+'-'+createHash('sha256').update(JSON.stringify([...shotIds].sort())).digest('hex').slice(0,12);}
import {inspectIllustrationReuse} from './illustrated-assets-v4';
import {requireIllustratedArtwork,type IllustratedStyleLock} from './illustration-schema';
export function validatePlannedReuse(shots:Shot[]){
 const keys=shots.map(s=>s.assetKey??s.id);if(keys.some((key,i)=>i>0&&key===keys[i-1]))throw new Error('Consecutive identical full scenes are forbidden: '+JSON.stringify(shots.map(s=>[s.id,s.assetKey??s.id])));
 for(const key of new Set(keys)){const group=shots.filter(s=>(s.assetKey??s.id)===key);if(group.length>4||group.some(s=>s.illustrationIdea?.concept!==group[0].illustrationIdea?.concept))throw new Error('Source reuse must have one consistent scene and at most four meaningful uses');if(group.length>1&&group.some(s=>!s.visualIntent||(!s.overlay&&!s.overlayArrow)))throw new Error('Reused source needs a meaningful editorial reveal, label or arrow');}
 return keys;
}
/** Corrective concept for the single allowed regeneration, phrased positively (naming a defect makes FLUX draw it); the rejected review stays as evidence. */
// legacy reproduces the wording of regenerations already drawn (run 38062820153) so their cached evidence still verifies.
export function regenerationIdea(idea:ArtworkIdea,style:IllustratedStyleLock,legacy=false):ArtworkIdea{
 const roles=idea.characterRoles.filter(r=>!/^none$/i.test(r));const eli=roles.some(r=>/eli/i.test(r));
 const anatomy=sourceBoundVision(idea);const fix=anatomy?(roles.length?'Human cast only: '+roles.join(', ')+'. Preserve the source-described visionary anatomy.':'Only the source-described visionary subject; no ordinary humans.') :roles.length?'Exactly '+roles.length+' adult character'+(roles.length>1?'s':'')+' ('+roles.join(', ')+(legacy?'), each with two simple clear cartoon hands drawn like input_image_0'+(eli?'; Eli wears his striped ochre head cloth':''):'), nobody else'+(eli?', Eli drawn exactly as in input_image_0':''))+'.':'An empty scene with no people at all.';
 const base=idea.concept.length+fix.length+1>420?idea.concept.slice(0,420-fix.length-1).replace(/\s+\S*$/,''):idea.concept;
 return fitNativeConcept(style,{...idea,id:idea.id+'-regen1',concept:base+' '+fix});
}
/** Reuse whichever regeneration wording produced an already drawn source, so its cached evidence verifies; otherwise use the current wording. */
async function cachedRegeneration(dir:string,idea:ArtworkIdea,style:IllustratedStyleLock){
 const current=regenerationIdea(idea,style),legacy=regenerationIdea(idea,style,true);
 try{const saved=await read(join(dir,'native-'+current.id+'-p3-source.json')) as {prompt?:string};return saved.prompt?.includes(legacy.concept)&&!saved.prompt.includes(current.concept)?legacy:current;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return current;}
}
/** Without planned reuse each beat owns its image; an editorial revision's fresh evidence ID replaces the beat ID so stale sources are never resumed. */
export function uniqueRevisionKey(shots:Shot[],shot:Shot){const key=shot.assetKey;return key&&key!==shot.id&&shots.filter(s=>s.assetKey===key).length===1?key:shot.id;}
export async function createIllustratedVideoAssets(shots:Shot[],style:IllustratedStyleLock,reference:string,dir:string,runner:Runner,vision:LLMProvider&VisionProvider,plannedReuse=false){
 const engine=new VisualStyleEngine(),assets=[];if(plannedReuse)validatePlannedReuse(shots);
 // Evidence for editorial repairs: the exact beat→source map with each beat's narration and planned source concept.
 if(plannedReuse)await log(runner.dir,'visual_beat_map',{beats:shots.map(s=>({shotId:s.id,source:s.assetKey??s.id,narration:s.narration,concept:s.illustrationIdea?.concept}))});
 const results=new Map<string,Awaited<ReturnType<VisualStyleEngine['generate']>>>();const crops=new Map<string,z.infer<typeof componentCrop>>();
 const failures:string[]=[];
 for(const shot of shots){if(!shot.illustrationIdea)throw new Error('Full illustrated source IDEA is required, never a primitive SVG scene');const key=plannedReuse?shot.assetKey??shot.id:uniqueRevisionKey(shots,shot);
 let result=results.get(key);if(!result){
  // One-image-per-beat mode records a failed prompt QA or a provider-flagged output with the other rejections instead of stopping at the first beat.
  try{result=await engine.generate({...shot.illustrationIdea,id:key},style,reference,join(dir,'illustrated-v4.2'),runner,vision,KLEIN_PRODUCTION_SIZE.width,KLEIN_PRODUCTION_SIZE.height);
  // One-image-per-beat mode: the style lock's single regeneration retries a rejected beat under a fresh evidence ID; the rejection stays recorded and every gate still applies.
  if(!plannedReuse&&style.maxRegenerationsPerScene>=1&&(!result.review.passed||!result.artwork))result=await engine.generate(await cachedRegeneration(runner.dir,{...shot.illustrationIdea,id:key},style),style,reference,join(dir,'illustrated-v4.2'),runner,vision,KLEIN_PRODUCTION_SIZE.width,KLEIN_PRODUCTION_SIZE.height);}
  catch(e){if(plannedReuse||!/^Native prompt QA failed|output has been flagged/.test(String((e as Error).message)))throw e;failures.push((e as Error).message);await log(runner.dir,'illustration_rejected',{shotId:shot.id,key,failure:(e as Error).message});continue;}
  if(!result.review.passed||!result.artwork){const failure='Native production illustration QA failed: '+key+' '+JSON.stringify(result.review.objectiveFailures)+' evidence '+JSON.stringify({issues:result.review.issues,seriousAnatomyDefects:result.review.seriousAnatomyDefects??[],densityRationale:result.review.densityRationale});
   // One-image-per-beat mode keeps drawing the remaining beats so one run reports every rejected beat; nothing rejected is ever accepted.
   if(plannedReuse)throw new Error(failure);failures.push(failure);await log(runner.dir,'illustration_rejected',{shotId:shot.id,key,failure});continue;}results.set(key,result);if(plannedReuse){const related=shots.filter(s=>(s.assetKey??s.id)===key);const reused=related.slice(1);if(reused.length){const schema=z.object({sourceSha256:z.literal(result.source.sha256),uses:z.array(z.object({shotId:z.string(),matchesNarration:z.boolean(),why:z.string().min(10),crop:componentCrop}))}).superRefine((v,c)=>{if(v.uses.length!==reused.length||new Set(v.uses.map(u=>u.shotId)).size!==reused.length||v.uses.some(u=>!reused.some(s=>s.id===u.shotId)))c.addIssue({code:'custom',message:'Annotate each exact reused beat once: uses must contain exactly these shotIds, each once, and no others: '+JSON.stringify(reused.map(s=>s.id))+'; received '+JSON.stringify(v.uses.map(u=>u.shotId))});});const source=result.source;const images=[await visionImage(source.path)];const layout=await runner.stage(await componentReuseStage(runner.dir,key,reused.map(s=>s.id)),schema,()=>validatedJSON({json:<T>(prompt:string,contract:z.ZodType<T>)=>vision.images(prompt,images,contract)},`Inspect the ACTUAL illustration. Return {sourceSha256:${JSON.stringify(source.sha256)},uses:[{shotId,matchesNarration,why,crop:{bounds:[x1,y1,x2,y2],subject,kind:character|object|environment-detail,placement:left|right}}]}. Reused beats must show a real component, NOT repeat the completed full scene and not create fake variety through tiny crops. Select a complete illustrated character, prop or meaningful environmental DETAIL actually relevant to each exact phrase, using full related narration for context. Bounds normalized 0–1, x before y, x1<x2,y1<y2, <=75% of source area. Include the entire selected human (head,hands,feet) or prop with a little space; never amputate a figure. Do not invent a component that is not drawn. matchesNarration false if no real component can support the beat. Alternate placement for new editorial composition. Reused beats ${JSON.stringify(reused.map(s=>({shotId:s.id,narration:s.narration,purpose:s.visualIntent})))}. Context ${JSON.stringify(related.map(s=>s.narration))}`,schema));if(layout.uses.some(u=>!u.matchesNarration))throw new Error('Actual component/narration mismatch: '+key+' evidence '+JSON.stringify(layout.uses.filter(u=>!u.matchesNarration).map(u=>({shotId:u.shotId,why:u.why,narration:reused.find(s=>s.id===u.shotId)?.narration}))));for(const use of layout.uses)crops.set(use.shotId,use.crop);}}}
 assets.push({editorialCrop:crops.get(shot.id),shotId:shot.id,path:result.source.path,sha256:result.source.sha256,kind:'image' as const,provider:'cloudflare-flux-free',sourceImageId:key,sourceSha256:result.source.sha256,editorialVariant:shot.visualIntent,license:'AI-generated original FLUX illustration; Apache-2.0 model and Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,intent:shot.narration+'; '+shot.visualIntent,fallbacks:[],artwork:result.artwork});}
 if(failures.length)throw new Error(failures.length+' rejected beat(s): '+failures.join(' | '));
 const reuse=inspectIllustrationReuse([...results.entries()].map(([id,result])=>({id,sha256:result.source.sha256})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
export async function loadIllustratedFixtures(shots:Shot[]){
 const path=process.env.ILLUSTRATED_ASSET_MANIFEST;if(!path)throw new Error('API-free demo needs an approved v4 illustrated fixture manifest. Never generate geometry as fallback.');
 const fixtures=z.object({humanApproved:z.literal(true),narrationByShot:z.record(z.string()),media}).parse(await read(path));
 const assets=shots.map(shot=>{const asset=fixtures.media.assets.find(a=>a.shotId===shot.id);if(!asset||fixtures.narrationByShot[shot.id]!==shot.narration)throw new Error('Approved demo artwork does not match this narration');requireIllustratedArtwork(asset);return asset;});
 for(const asset of assets)if(await fileDigest(asset.path)!==asset.sha256)throw new Error('Approved demo fixture checksum changed');
 const reuse=inspectIllustrationReuse(assets.map(a=>({id:a.shotId,sha256:a.sourceSha256!})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
