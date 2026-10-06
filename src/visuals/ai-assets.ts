import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {json,read,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {estimateDepth} from './depth';
import {historicalPrompt,type VisualBible} from './bible';
import type {ImageProvider} from '../providers/interfaces';
import type {Shot,MediaAsset} from '../editor/schemas';
import {currentCosts} from '../cost';
export async function createHistoricalAssets(shots:Shot[],bible:VisualBible,dir:string,image:ImageProvider){
 await mkdir(dir,{recursive:true});const assets:MediaAsset[]=[];
 for(const shot of shots){const folder=join(dir,(shot.assetKey||shot.id)+'-depth'),raw=join(folder,'flux.png'),checkpoint=join(folder,'image-checkpoint.json');await mkdir(folder,{recursive:true});const prompt=historicalPrompt(bible,shot.assetPrompt);let cached=false;
 try{const previous=await read(checkpoint);if(previous.prompt!==prompt||previous.sha256!==await fileDigest(raw))throw new Error('Historical image checkpoint changed; use a new run ID');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(!cached){const ledger=currentCosts();if(ledger&&ledger.entries.filter(e=>e.category==='generatedImages').length>=ledger.policy.maxGeneratedImagesPerVideo)throw new Error('Generated image cap reached; checkpoint saved');const generate=()=>image.generate(prompt,raw);if(ledger)await ledger.charge('generatedImages','cloudflare-flux-free',0,shot.id,generate);else await generate();await json(checkpoint,{prompt,sha256:await fileDigest(raw),model:'@cf/black-forest-labs/flux-1-schnell',license:'Apache-2.0 model; Cloudflare/BFL terms apply'});}
 const depthLayers=await estimateDepth(raw,folder);const path=join(dir,shot.id+'.png');const variant=shot.editorialReframe??0;await exec('ffmpeg',['-y','-v','error','-i',join(folder,'frame.png'),'-vf',`crop=1880:1056:${variant===1?38:2}:12,scale=1920:1080`,'-frames:v','1',path],{timeout:20000});await exec('ffmpeg',['-v','error','-i',path,'-frames:v','1','-f','null','-'],{timeout:20000});assets.push({shotId:shot.id,path,kind:'image',provider:'cloudflare-flux-free',license:'FLUX.1 Schnell model Apache-2.0; AI reconstruction, Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,qualityScore:85,intent:shot.visualIntent,fallbacks:[],sha256:await fileDigest(path),depthLayers});
 }
 return {assets,estimatedTotalCost:0};
}
