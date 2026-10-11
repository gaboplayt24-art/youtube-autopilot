import {copyFile,mkdir} from 'node:fs/promises';
import {join,basename} from 'node:path';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import type {Composition} from '../orchestration/schemas';
import {Runner} from '../orchestration/runner';
import {fileDigest} from '../orchestration/integrity';
import {renderThumbnail} from '../render';
import {inspectThumbnail} from '../thumbnail';
import {VisualStyleEngine,fitNativeConcept} from '../visuals/native-v4-2';
import {artworkIdea,type IllustratedStyleLock} from '../visuals/illustration-schema';
import {packagingPlan,thumbnailPackagingScore} from './schemas';
import {z} from 'zod';
import {KLEIN_PRODUCTION_SIZE} from '../providers/cloudflare';
import {json,read} from '../orchestration/io';
import {validatedJSON} from '../providers/validated-json';
/** Evidence-based editorial repair of a rejected thumbnail artwork concept; the approved title, overlay and PackagingScore stay unchanged. */
export const thumbnailRevision=z.object({runId:z.string(),revisions:z.array(z.object({variant:z.enum(['A','B','C']),id:z.string().regex(/^thumbnail-[ABC]-/),concept:z.string().min(30).max(420),characterRoles:z.array(z.string().max(60)).max(4),historicalContext:z.string().min(10).max(180).optional(),overlay:z.string().max(35).refine(t=>t.trim().split(/\s+/).length<=4,'At most four words').optional(),localizedOverlays:z.record(z.string().min(2),z.string().max(35).refine(t=>t.trim().split(/\s+/).length<=4,'At most four words')).optional(),reason:z.string().min(10)}))});
async function thumbnailRevisions(runId:string){try{const r=thumbnailRevision.parse(await read(join('data','scripts',runId+'-thumbnail-revisions.json')));if(r.runId!==runId)throw new Error('Thumbnail revision belongs to a different run');return r.revisions;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
/** ALHQ-level clarity by abstract principles only: one large expressive focal subject, simple separated background, clear top for the Remotion title. Fits the 420-character artwork concept limit. */
// v5: each variant gets its own saturated backdrop so Test & Compare compares genuinely different thumbnails, and dark-mode feeds never swallow a black frame.
const V5_BACKDROPS=['warm amber-orange rock','deep teal-blue night','rich crimson-red'] as const;
export function thumbnailConcept(c:{focalSubject:string;expressionOrSituation:string;background:string},v5=false,index=0){
 if(v5){const tail=`Big close-up: Eli's head and shoulders fill the right half of the frame with an EXAGGERATED shocked expression (eyes very wide, eyebrows raised high, mouth wide open), looking toward the large bright glowing curiosity object on the lower left. Plain ${V5_BACKDROPS[index%3]} background with soft light behind his head; upper left kept plain. No lettering.`;const full=`${c.focalSubject}: ${c.expressionOrSituation}. ${tail}`;return full.length<=420?full:tail;}
 const tail='Close-up: one large expressive adult face and torso fills half the frame on one side, strong mature emotion; small story scene behind; brighter saturated colours; simple top quarter; no lettering.';
 const full=`One focal ${c.focalSubject}. ${c.expressionOrSituation}. Background: ${c.background}. ${tail}`;
 return full.length<=420?full:`One focal ${c.focalSubject}. ${c.expressionOrSituation}. ${tail}`.slice(0,420);
}
export async function generatePackagedThumbnails(plan:z.infer<typeof packagingPlan>,composition:Composition,style:IllustratedStyleLock,reference:string,dir:string,runId:string,runner:Runner,vision:LLMProvider&VisionProvider,historicalContext:string){
 // A close-up crop of the approved reference, when the style lock pins one, lets Klein draw a large expressive face for thumbnails.
 const thumbReference=style.thumbnailReference?.path??reference,thumbStyle=style.thumbnailReference?{...style,referenceSha256:style.thumbnailReference.sha256}:style;
 if(style.thumbnailReference&&await fileDigest(thumbReference)!==style.thumbnailReference.sha256)throw new Error('Thumbnail reference integrity mismatch');
 const engine=new VisualStyleEngine(),variants=[],finalConcepts=[],publicDir=join('public',runId),revisions=await thumbnailRevisions(runId);await mkdir(publicDir,{recursive:true});
 for(const [index,original]of plan.concepts.entries()){
  const evidence=composition.scenes.map(s=>s.text).join(' ');
  const concept=await runner.stage('thumbnail-concept-'+index,packagingPlan.shape.concepts.element,()=>validatedJSON(vision,`Finalize this provisional original thumbnail against the FACT-CHECKED narration. Preserve id,composition and subjective scores; title remains ${plan.titles[index]}. Reuse the concept ONLY if all its focal props/curiosity are actually covered in the script. Otherwise adapt it to a concrete script-supported prop or scene while maintaining one primary focal point, optional 0–3 words Remotion overlay, own native illustrated style, no copied composition. Never present an unmentioned sponge/tool as a historical artifact or invent a threat. The three variants must differ materially. Return ONE object {id,composition,focalSubject,expressionOrSituation,background,overlay,curiosity,scores}. Provisional ${JSON.stringify(original)}. Other provisional concepts ${JSON.stringify(plan.concepts)}. Actual narration ${evidence}`,packagingPlan.shape.concepts.element));finalConcepts.push(concept);await json(join(dir,'thumbnail-final-concepts.json'),finalConcepts);
  if(thumbnailPackagingScore(concept.scores)<82)throw new Error('Thumbnail concept is below PackagingScore 82');
  const revision=revisions.find(r=>r.variant===['A','B','C'][index]);
  const idea=fitNativeConcept(style,artworkIdea.parse({id:revision?.id??'thumbnail-'+['A','B','C'][index]+'-hq',narration:plan.topic,historicalContext:revision?.historicalContext??historicalContext,concept:revision?.concept??thumbnailConcept(concept,style.version==='round-head-v5',index),overlay:revision?.overlay??(concept.overlay||null),labelPlacement:concept.composition==='left-subject'?'right':concept.composition==='right-subject'?'left':'top',characterRoles:revision?.characterRoles??[]}));
  let result=await engine.generate(idea,thumbStyle,thumbReference,join(dir,'thumbnail-sources'),runner,vision,KLEIN_PRODUCTION_SIZE.width,KLEIN_PRODUCTION_SIZE.height);
  // v5 thumbnails get the style lock's single regeneration under a fresh evidence ID, like v5 beats; the rejected review stays recorded.
  if(style.version==='round-head-v5'&&style.maxRegenerationsPerScene>=1&&(!result.review.passed||!result.artwork))result=await engine.generate({...idea,id:idea.id+'-regen1'},thumbStyle,thumbReference,join(dir,'thumbnail-sources'),runner,vision,KLEIN_PRODUCTION_SIZE.width,KLEIN_PRODUCTION_SIZE.height);
  if(!result.review.passed||!result.artwork)throw new Error('Native thumbnail artwork QA failed: '+idea.id+' evidence '+JSON.stringify({concept:idea.concept,objectiveFailures:result.review.objectiveFailures,issues:result.review.issues,seriousAnatomyDefects:result.review.seriousAnatomyDefects??[]}));const file=basename(result.source.path);await copyFile(result.source.path,join(publicDir,file));
  const variant=['A','B','C'][index] as 'A'|'B'|'C',path=join(dir,`thumbnail-${variant}.png`);await renderThumbnail({...composition,thumbnailTitle:(idea.overlay??concept.overlay),thumbnailVariant:variant,assets:[{shotId:idea.id,kind:'image',path:runId+'/'+file,provider:'cloudflare-flux-free',sha256:result.source.sha256,sourceSha256:result.source.sha256,artwork:result.artwork,license:'Original AI artwork, Klein 4B Apache-2.0 and provider terms',sourceUrl:null,intent:idea.concept,fallbacks:[],estimatedCost:0}]},path);const scores=await inspectThumbnail(path,(idea.overlay??concept.overlay),plan.titles[index],false,true);variants.push({variant,path,sha256:await fileDigest(path),scores:{...scores,PackagingScore:thumbnailPackagingScore(concept.scores)}});
  // Owner-approved 2026-10-11: the same artwork with translated labels, for YouTube Studio's per-language thumbnails (not settable through the API).
  for(const [lang,label] of Object.entries(revision?.localizedOverlays??{})){const localized=join(dir,`thumbnail-${variant}-${lang}.png`);await renderThumbnail({...{...composition,thumbnailTitle:(idea.overlay??concept.overlay),thumbnailVariant:variant,assets:[{shotId:idea.id,kind:'image',path:runId+'/'+file,provider:'cloudflare-flux-free',sha256:result.source.sha256,sourceSha256:result.source.sha256,artwork:result.artwork,license:'Original AI artwork, Klein 4B Apache-2.0 and provider terms',sourceUrl:null,intent:idea.concept,fallbacks:[],estimatedCost:0}]},thumbnailTitle:label},localized);await inspectThumbnail(localized,label,plan.titles[index],false,true);}
 }
 const selected=join(dir,'thumbnail.png');await copyFile(variants[0].path,selected);return {path:selected,variant:'A',sha256:variants[0].sha256,variants};
}
