import {copyFile,mkdir} from 'node:fs/promises';
import {join,basename} from 'node:path';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import type {Composition} from '../orchestration/schemas';
import {Runner} from '../orchestration/runner';
import {fileDigest} from '../orchestration/integrity';
import {renderThumbnail} from '../render';
import {inspectThumbnail} from '../thumbnail';
import {VisualStyleEngine} from '../visuals/native-v4-2';
import {artworkIdea,type IllustratedStyleLock} from '../visuals/illustration-schema';
import {packagingPlan,thumbnailPackagingScore} from './schemas';
import {z} from 'zod';
import {json} from '../orchestration/io';
import {validatedJSON} from '../providers/validated-json';
export async function generatePackagedThumbnails(plan:z.infer<typeof packagingPlan>,composition:Composition,style:IllustratedStyleLock,reference:string,dir:string,runId:string,runner:Runner,vision:LLMProvider&VisionProvider,historicalContext:string){
 const engine=new VisualStyleEngine(),variants=[],finalConcepts=[],publicDir=join('public',runId);await mkdir(publicDir,{recursive:true});
 for(const [index,original]of plan.concepts.entries()){
  const evidence=composition.scenes.map(s=>s.text).join(' ');
  const concept=await runner.stage('thumbnail-concept-'+index,packagingPlan.shape.concepts.element,()=>validatedJSON(vision,`Finalize this provisional original thumbnail against the FACT-CHECKED narration. Preserve id,composition and subjective scores; title remains ${plan.titles[index]}. Reuse the concept ONLY if all its focal props/curiosity are actually covered in the script. Otherwise adapt it to a concrete script-supported prop or scene while maintaining one primary focal point, optional 0–3 words Remotion overlay, own native illustrated style, no copied composition. Never present an unmentioned sponge/tool as a historical artifact or invent a threat. The three variants must differ materially. Return ONE object {id,composition,focalSubject,expressionOrSituation,background,overlay,curiosity,scores}. Provisional ${JSON.stringify(original)}. Other provisional concepts ${JSON.stringify(plan.concepts)}. Actual narration ${evidence}`,packagingPlan.shape.concepts.element));finalConcepts.push(concept);await json(join(dir,'thumbnail-final-concepts.json'),finalConcepts);
  if(thumbnailPackagingScore(concept.scores)<82)throw new Error('Thumbnail concept is below PackagingScore 82');
  const idea=artworkIdea.parse({id:'thumbnail-'+['A','B','C'][index],narration:plan.topic,historicalContext,concept:`One focal ${concept.focalSubject}. ${concept.expressionOrSituation}. Simple background: ${concept.background}. Clear silhouette, expressive situation, safe margins; no clutter, no lettering.`,overlay:concept.overlay||null,labelPlacement:concept.composition==='left-subject'?'right':concept.composition==='right-subject'?'left':'top',characterRoles:[]});
  const result=await engine.generate(idea,style,reference,join(dir,'thumbnail-sources'),runner,vision,1920,1080);if(!result.review.passed||!result.artwork)throw new Error('Native thumbnail artwork QA failed');const file=basename(result.source.path);await copyFile(result.source.path,join(publicDir,file));
  const variant=['A','B','C'][index] as 'A'|'B'|'C',path=join(dir,`thumbnail-${variant}.png`);await renderThumbnail({...composition,thumbnailTitle:concept.overlay,thumbnailVariant:variant,assets:[{shotId:idea.id,kind:'image',path:runId+'/'+file,provider:'cloudflare-flux-free',sha256:result.source.sha256,sourceSha256:result.source.sha256,artwork:result.artwork,license:'Original AI artwork, Klein 4B Apache-2.0 and provider terms',sourceUrl:null,intent:idea.concept,fallbacks:[],estimatedCost:0}]},path);const scores=await inspectThumbnail(path,concept.overlay,plan.titles[index],false,true);variants.push({variant,path,sha256:await fileDigest(path),scores:{...scores,PackagingScore:thumbnailPackagingScore(concept.scores)}});
 }
 const selected=join(dir,'thumbnail.png');await copyFile(variants[0].path,selected);return {path:selected,variant:'A',sha256:variants[0].sha256,variants};
}
