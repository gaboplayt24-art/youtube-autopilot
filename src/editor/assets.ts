import {join} from 'node:path';
import {access,writeFile} from 'node:fs/promises';
import type {ImageProvider,StockProvider,VideoProvider} from '../providers/interfaces';
import {EditorialIllustrator} from '../visuals/editorial';
import {downloadStock} from '../providers/media';
import {CloudflareWorkersAIImageProvider} from '../providers/cloudflare';
import {currentCosts,paidCall,loadCostPolicy,type CostPolicy} from '../cost';
import {fileDigest} from '../orchestration/integrity';
import {json,read} from '../orchestration/io';
import {duration,exec} from '../orchestration/io';
import type {Shot,VisualProfile,MediaAsset} from './schemas';
export type AssetProviders={image?:ImageProvider;stock?:StockProvider;commons?:StockProvider;policy?:CostPolicy;video?:VideoProvider};
export function productionAssets():AssetProviders{return {image:new CloudflareWorkersAIImageProvider()};}
export async function createAssets(shots:Shot[],profile:VisualProfile,dir:string,providers:AssetProviders={}){
 const assets:MediaAsset[]=[];let total=0;let aiVideoTotal=0;let generatedImages=currentCosts()?.entries.filter(e=>e.category==='generatedImages').length??0;const policy=providers.policy??currentCosts()?.policy??await loadCostPolicy();const illustrator=new EditorialIllustrator();
 for(const shot of shots){const checkpoint=join(dir,shot.id+'.asset.json');let previous:MediaAsset|undefined;try{const cached=await read(checkpoint);if(cached.shotFingerprint!==JSON.stringify(shot)||cached.asset.sha256!==await fileDigest(cached.asset.path))throw new Error('Asset checkpoint invalid; refusing paid regeneration');previous=cached.asset;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(previous){assets.push(previous);total+=previous.estimatedCost;if(previous.provider==='ai-video')aiVideoTotal+=previous.estimatedCost;continue;}const failures:string[]=[];let selected:{path:string;kind:MediaAsset['kind'];provider:string;license:string;sourceUrl:string|null;cost:number;qualityScore:number;creator?:string;licenseUrl?:string;attribution?:string;publicDomain?:boolean}|undefined;
  const attempt=async(label:string,fn:()=>Promise<NonNullable<typeof selected>>)=>{try{const result=await fn();await access(result.path);if(result.kind==='video'&&await duration(result.path)<shot.end-shot.start)throw new Error('Clip too short');if(result.kind==='image'||result.kind==='video'){const probe=await exec('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',result.path],{timeout:20000});const stream=JSON.parse(probe.stdout).streams?.find((s:any)=>s.width);if(!stream)throw new Error('Undecodable media');const pixels=stream.width*stream.height;result.qualityScore=Math.min(result.qualityScore,pixels>=1280*720?85:60);if(result.qualityScore<policy.qualityFloor)throw new Error('Media resolution below configured technical floor');}selected=result;}catch(e){failures.push(`${label}: ${e instanceof Error?e.message:'unavailable'}`);}};
  const graphic=['map','chart','timeline','document','headline','quote','kinetic-text','diagram','icon-scene'].includes(shot.shotType);
  if(!graphic){
   const videoCost=providers.video?.estimateCost?.(shot.end-shot.start)??Infinity;
   if(policy.aiVideoEnabled&&shot.highImpact&&providers.video&&aiVideoTotal+videoCost<=profile.aiVideoBudgetUsd&&total+videoCost<=profile.assetBudgetUsd)await attempt('ai-video',async()=>{const path=join(dir,shot.id+'.mp4');await paidCall('aiVideo','ai-video',videoCost,shot.id,()=>providers.video!.generate(shot.assetPrompt,path));return {path,kind:'video',provider:'ai-video',license:'Provider-generated; user must verify commercial terms',sourceUrl:null,cost:videoCost,qualityScore:85};});
   const stock=async(label:string,provider:StockProvider,kind:'image'|'video')=>attempt(label,async()=>{const item=await provider.search(shot.searchQuery||shot.keywords.slice(0,3).join(' ')||shot.narration,kind,shot.end-shot.start);if(!item)throw new Error('No suitable licensed asset');const path=join(dir,shot.id+(kind==='video'?'.mp4':'.jpg'));await downloadStock(item,path);const ledger=currentCosts();if(ledger)await ledger.charge('stock',label,0,shot.id,async()=>undefined);return {path,kind,provider:label,license:`${item.license}${item.licenseUrl?' ('+item.licenseUrl+')':''}; Credit: ${item.attribution}`,sourceUrl:item.sourceUrl,creator:item.creator,licenseUrl:item.licenseUrl,attribution:item.attribution,publicDomain:item.publicDomain,cost:0,qualityScore:85};});
   if(!selected&&providers.commons)await stock('wikimedia-commons',providers.commons,'image');
   if(!selected&&providers.stock)await stock('pexels-video',providers.stock,'video');
   if(!selected&&providers.stock)await stock('pexels-image',providers.stock,'image');

  }
  if(!selected)await attempt('motion-graphic',async()=>{const vector=join(dir,shot.id+'.svg');const path=join(dir,shot.id+'.png');await illustrator.generate(`${shot.id} ${shot.visualIntent}`,vector);await exec('ffmpeg',['-y','-v','error','-i',vector,'-frames:v','1',path],{timeout:20000});return {path,kind:'graphic',provider:'original-editorial',license:'Original runtime illustration, CC0',sourceUrl:null,cost:0,qualityScore:graphic||/attention|focus|library|spotlight|maze|mountain/i.test(shot.visualIntent)?85:60};});
  const freeChoice=selected as NonNullable<typeof selected>|undefined;
  const paidEligible=shot.highImpact||/historical reconstruction/i.test(shot.visualIntent);
  if(freeChoice&&freeChoice.qualityScore<policy.qualityFloor&&paidEligible&&providers.image&&generatedImages<policy.maxGeneratedImagesPerVideo&&total+policy.rates.generatedImage<=Math.min(profile.assetBudgetUsd,policy.maxCostPerVideoUsd)){
   selected=undefined;generatedImages++;await attempt('generated-image',async()=>{const path=join(dir,shot.id+'.png');await providers.image!.generate(shot.assetPrompt,path);return {path,kind:'image',provider:'openai-image',license:'Original generated image; provider commercial terms apply',sourceUrl:null,cost:policy.rates.generatedImage,qualityScore:80};});if(!selected)selected=freeChoice;
  }
  if(!selected)await attempt('kinetic-text',async()=>{const path=join(dir,shot.id+'-kinetic.svg');await writeFile(path,'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><radialGradient id="g"><stop stop-color="#25434e"/><stop offset="1" stop-color="#08121e"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="1400" cy="400" r="260" stroke="#bc955e" stroke-width="4" fill="none"/><path d="M100 800L600 500L1100 750L1750 200" stroke="#649b99" stroke-width="5" fill="none"/></svg>');return {path,kind:'graphic',provider:'kinetic-text',license:'Original kinetic illustration, CC0',sourceUrl:null,cost:0,qualityScore:50};});
  if(!selected)throw new Error(`All visual fallbacks failed for ${shot.id}; refusing a blank shot`);
  const result=selected as NonNullable<typeof selected>;if(result.cost===0&&['original-editorial','kinetic-text'].includes(result.provider)&&currentCosts())await currentCosts()!.charge('stock',result.provider,0,shot.id,async()=>undefined);total+=result.cost;if(result.provider==='ai-video')aiVideoTotal+=result.cost;const asset={shotId:shot.id,...result,estimatedCost:result.cost,intent:shot.visualIntent,fallbacks:failures,sha256:await fileDigest(result.path)};assets.push(asset);await json(checkpoint,{shotFingerprint:JSON.stringify(shot),asset});
 }
 return {assets,estimatedTotalCost:total};
}
