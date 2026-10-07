import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir,copyFile} from 'node:fs/promises';
import {json,read,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {estimateDepth} from './depth';
import {historicalPrompt,type VisualBible} from './bible';
import type {ImageProvider} from '../providers/interfaces';
import type {LLMProvider} from '../providers/interfaces';
import {z} from 'zod';
import type {Shot,MediaAsset} from '../editor/schemas';
import {currentCosts} from '../cost';
const promptReview=z.object({id:z.string(),passed:z.boolean(),issues:z.array(z.string()),anachronisms:z.array(z.string())});
export async function createHistoricalAssets(shots:Shot[],bible:VisualBible,dir:string,image:ImageProvider,reviewer?:LLMProvider,canonicalAssets:Record<string,string[]>={},prepareOnly=false,approvedPrompts?:string[]){
 await mkdir(dir,{recursive:true});const assets:MediaAsset[]=[];
 // Validate the complete batch before spending any image quota.
 const prompts=shots.map(shot=>({id:shot.id,prompt:historicalPrompt(bible,shot.assetPrompt)}));
 if(!reviewer)throw new Error('Gemini prompt review is required before FLUX generation');
 const bibleHash=await fileDigest(join(dir,'..','visual-bible.json')).catch(()=>null);
 const reviewPath=join(dir,'prompt-review.json');const reviewSource=JSON.stringify({bible,prompts});const sourceHash=createHash('sha256').update(reviewSource).digest('hex');
 let reviews: z.infer<typeof promptReview>[]|null=null;if(approvedPrompts){if(prompts.some(p=>!approvedPrompts.includes(p.prompt)))throw new Error('Shot uses an unreviewed historical prompt');reviews=prompts.map(p=>({id:p.id,passed:true,issues:[],anachronisms:[]}));}try{const cached=await read(reviewPath);if(cached.sourceHash===sourceHash)reviews=promptReview.array().parse(cached.reviews);}catch{/* stale or malformed evidence is re-reviewed */}
 if(!reviews){const batch=await reviewer.json(`Review EVERY FINAL historical image prompt before FLUX. Check exact period, civilization, architecture, materials, clothes, hair, weapons, boats, streets, technology and major anachronisms against the bible. Do not rewrite prompts. Minor aesthetic preferences are REVIEW, not hard failures. Return {reviews:[{id,passed,issues,anachronisms}]} with one entry for EACH exact supplied id. Bible: ${JSON.stringify(bible)}. Prompts: ${JSON.stringify(prompts)}`,z.object({reviews:promptReview.array()}));reviews=batch.reviews;await json(reviewPath,{sourceHash,bibleHash,reviews,model:'See gemini-cache and logs for actual model',reviewedAt:new Date().toISOString()});}
 if(reviews.length!==prompts.length||reviews.some(r=>!r.passed||r.id!==prompts.find(p=>p.id===r.id)?.id))throw new Error('Gemini rejected one or more historical image prompts; no FLUX request was made');
 if(prepareOnly)return {assets:[],estimatedTotalCost:0};
 for(const shot of shots){const canonical=shot.assetKey?canonicalAssets[shot.assetKey]?.[(shot.editorialReframe??0)%canonicalAssets[shot.assetKey].length]:undefined;const folder=join(dir,canonical?`${shot.id}-canonical-depth`:(shot.assetKey||shot.id)+'-depth'),raw=join(folder,'flux.png'),checkpoint=join(folder,'image-checkpoint.json');await mkdir(folder,{recursive:true});const prompt=historicalPrompt(bible,shot.assetPrompt);let cached=false;
 try{const previous=await read(checkpoint);if(previous.prompt!==prompt||(previous.source??null)!==(canonical??null)||previous.sha256!==await fileDigest(raw))throw new Error('Historical image checkpoint changed; use a new run ID');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(!cached&&canonical){await copyFile(canonical,raw);await json(checkpoint,{prompt,source:canonical,sha256:await fileDigest(raw),model:'canonical-character-pack'});cached=true;}
 if(!cached){const ledger=currentCosts();if(ledger&&ledger.entries.filter(e=>e.category==='generatedImages').length>=ledger.policy.maxGeneratedImagesPerVideo)throw new Error('Generated image cap reached; checkpoint saved');const generate=()=>image.generate(prompt,raw);if(ledger)await ledger.charge('generatedImages','cloudflare-flux-free',0,shot.id,generate);else await generate();await json(checkpoint,{prompt,source:null,sha256:await fileDigest(raw),model:'@cf/black-forest-labs/flux-1-schnell',license:'Apache-2.0 model; Cloudflare/BFL terms apply'});}
 const depthLayers=await estimateDepth(raw,folder);const path=join(dir,shot.id+'.png');const variant=shot.editorialReframe??0;await exec('ffmpeg',['-y','-v','error','-i',join(folder,'frame.png'),'-vf',`crop=1880:1056:${variant===1?38:2}:12,scale=1920:1080`,'-frames:v','1',path],{timeout:20000});await exec('ffmpeg',['-v','error','-i',path,'-frames:v','1','-f','null','-'],{timeout:20000});assets.push({shotId:shot.id,path,kind:'image',provider:'cloudflare-flux-free',license:'FLUX.1 Schnell model Apache-2.0; AI reconstruction, Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,qualityScore:85,intent:shot.visualIntent,fallbacks:[],sha256:await fileDigest(path),depthLayers});
 }
 return {assets,estimatedTotalCost:0};
}
