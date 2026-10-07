import {z} from 'zod';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import type {ImageProvider,VisionProvider} from '../providers/interfaces';
import {Runner} from '../orchestration/runner';
import {exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {currentCosts} from '../cost';
import {FLUX_MODEL} from '../providers/cloudflare';
import {reviewIllustration,visionImage} from './style-reference-v4';
import {validatedJSON} from '../providers/validated-json';
import {styleReview,primaryArtwork,type ArtworkIdea,type IllustratedStyleLock} from './illustration-schema';
export const generatedSource=z.object({path:z.string(),sha256:z.string().length(64),model:z.literal(FLUX_MODEL),prompt:z.string()});
export const acceptedIllustration=z.object({ideaId:z.string(),source:generatedSource,framedPath:z.string(),framedSha256:z.string().length(64),attempt:z.number().int(),review:styleReview,artwork:primaryArtwork});
export type IllustrationEvidence=Omit<z.infer<typeof acceptedIllustration>,'artwork'>;
export class IllustrationStyleRejected extends Error{constructor(public readonly evidence:IllustrationEvidence){super(`Style reference QA failed for ${evidence.ideaId}; rejected sources retained. No geometry fallback and no video.`);}}
export function illustrationPrompt(style:IllustratedStyleLock,idea:ArtworkIdea,corrections:string[]=[]){
 if(style.referenceAnalysisStatus!=='analysed'||!style.referenceSha256||!style.referenceStyleDescriptor)throw new Error('Actual reference analysis is required before FLUX spending');
 const prompt=`${style.prefix} Reference traits: ${style.referenceStyleDescriptor}. Original scene: ${idea.concept}. Setting: ${idea.historicalContext}. Draw a complete wide educational scene inside the middle 56% horizontal band of the square canvas; cream margins above/below, keep all heads/hands/essential props inside that band for 16:9 crop. Reserve clear ${idea.labelPlacement} space for later editorial label, draw NO words. ${style.negativeRules.join('; ')}.${corrections.length?' Repair: '+corrections.slice(0,2).map(s=>s.slice(0,90)).join('; '):''}`;
 if(prompt.length>2048)throw new Error('FLUX prompt exceeds 2048 characters; shorten the visual concept, never truncate the immutable style prefix');
 return prompt;
}
export async function generateIllustration(idea:ArtworkIdea,style:IllustratedStyleLock,reference:string,dir:string,runner:Runner,image:ImageProvider,vision:VisionProvider){
 await mkdir(dir,{recursive:true});let corrections:string[]=[],lastRejected:IllustrationEvidence|undefined;
 for(let attempt=0;attempt<=style.maxRegenerationsPerScene;attempt++){
  const name=`illustration-${idea.id}-attempt-${attempt}`,path=join(dir,`${idea.id}-attempt-${attempt}-source.png`),framedPath=join(dir,`${idea.id}-attempt-${attempt}-16x9.png`),prompt=illustrationPrompt(style,idea,corrections);
  const promptSchema=z.object({passed:z.boolean(),historicallyPlausible:z.boolean(),styleConsistent:z.boolean(),noBakedText:z.boolean(),issues:z.array(z.string())});
  const promptReview=await runner.stage(name+'-prompt-QA',promptSchema,async()=>{const referenceImage=await visionImage(reference);return validatedJSON({json:<T>(p:string,s:z.ZodType<T>)=>vision.images(p,[referenceImage],s)},`BEFORE spending FLUX quota, review this image prompt against the actual positive style reference and historical context. Prompt ${JSON.stringify(prompt)}. Context ${JSON.stringify(idea.historicalContext)}. Check century/civilization, regional architecture, materials, clothing, hair, weapons, boats, streets, technology and known anachronisms if visible. It must describe actual illustrated people/props/environment, never code geometry, photorealism or labels to be spelled. Do not rewrite the immutable prefix. Return {passed,historicallyPlausible,styleConsistent,noBakedText,issues:[string]}.`,promptSchema);});
  if(!promptReview.passed||!promptReview.historicallyPlausible||!promptReview.styleConsistent||!promptReview.noBakedText||promptReview.issues.length)throw new Error('Historical/style prompt review failed BEFORE FLUX generation; no geometry fallback');
  const source=await runner.stage(name,generatedSource,async()=>{const costs=currentCosts();if(!costs)throw new Error('FLUX requires the persistent cost ledger');await costs.charge('generatedImages','cloudflare-flux-free',0,idea.id,()=>image.generate(prompt,path));return {path,sha256:await fileDigest(path),model:FLUX_MODEL,prompt};},async a=>{if(a.sha256!==await fileDigest(a.path))throw new Error('FLUX source checksum changed');});
  const framed=await runner.stage(name+'-framing',z.object({path:z.string(),sha256:z.string().length(64)}),async()=>{await exec('ffmpeg',['-y','-v','error','-i',source.path,'-vf','scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080','-frames:v','1',framedPath],{timeout:20000});return {path:framedPath,sha256:await fileDigest(framedPath)};},async a=>{if(a.sha256!==await fileDigest(a.path))throw new Error('Illustration crop checksum changed');});
  const review=await runner.stage(name+'-reference-QA',styleReview,()=>reviewIllustration(reference,source.path,framed.path,idea,style,vision));
  if(review.passed)return acceptedIllustration.parse({ideaId:idea.id,source,framedPath:framed.path,framedSha256:framed.sha256,attempt,review,artwork:{generationMethod:'ai-illustration',styleVersion:'illustrated-doodle-v4',model:FLUX_MODEL,referenceSha256:style.referenceSha256,sourceSha256:source.sha256,referenceQAPassed:true}});
  lastRejected={ideaId:idea.id,source:generatedSource.parse(source),framedPath:framed.path,framedSha256:framed.sha256,attempt,review};
  corrections=review.issues.length?review.issues:['Match the positive reference: organic drawn anatomy, clothing and props; never geometric icons.'];
 }
 if(lastRejected)throw new IllustrationStyleRejected(lastRejected);
 throw new Error('No illustration evidence available');
}
export function inspectIllustrationReuse(sources:{id:string;sha256:string}[],maximumUses=2){
 const issues:string[]=[],counts=new Map<string,number>();for(const [i,source]of sources.entries()){const count=(counts.get(source.sha256)??0)+1;counts.set(source.sha256,count);if(i&&sources[i-1].sha256===source.sha256)issues.push(source.id+': consecutive full-frame source reuse');if(count>maximumUses)issues.push(source.id+': excessive source reuse');}
 return {passed:issues.length===0,issues,uniqueSources:counts.size};
}
