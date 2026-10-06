import {join} from 'node:path';
import {access,writeFile} from 'node:fs/promises';
import type {ImageProvider,StockProvider,VideoProvider} from '../providers/interfaces';
import {EditorialIllustrator} from '../visuals/editorial';
import {downloadStock,PexelsProvider} from '../providers/media';
import {OpenAIImageProvider} from '../providers/openai';
import {fileDigest} from '../orchestration/integrity';
import {duration,exec} from '../orchestration/io';
import type {Shot,VisualProfile,MediaAsset} from './schemas';
export type AssetProviders={image?:ImageProvider;stock?:StockProvider;video?:VideoProvider};
export function productionAssets():AssetProviders{return {image:process.env.IMAGE_PROVIDER==='openai'?new OpenAIImageProvider():undefined,stock:process.env.STOCK_PROVIDER==='pexels'?new PexelsProvider():undefined};}
export async function createAssets(shots:Shot[],profile:VisualProfile,dir:string,providers:AssetProviders={}){
 const assets:MediaAsset[]=[];let total=0;let aiVideoTotal=0;const illustrator=new EditorialIllustrator();
 for(const shot of shots){const failures:string[]=[];let selected:{path:string;kind:MediaAsset['kind'];provider:string;license:string;sourceUrl:string|null;cost:number}|undefined;
  const attempt=async(label:string,fn:()=>Promise<NonNullable<typeof selected>>)=>{try{const result=await fn();await access(result.path);if(result.kind==='video'&&await duration(result.path)<shot.end-shot.start)throw new Error('Clip too short');if(result.kind==='image'){await exec('ffprobe',['-v','error','-show_entries','stream=width,height',result.path],{timeout:20000});}selected=result;}catch(e){failures.push(`${label}: ${e instanceof Error?e.message:'unavailable'}`);}};
  const graphic=['map','chart','timeline','document','headline','quote','kinetic-text','diagram','icon-scene'].includes(shot.shotType);
  if(!graphic){
   const videoCost=providers.video?.estimateCost?.(shot.end-shot.start)??Infinity;
   if(shot.highImpact&&providers.video&&aiVideoTotal+videoCost<=profile.aiVideoBudgetUsd&&total+videoCost<=profile.assetBudgetUsd)await attempt('ai-video',async()=>{const path=join(dir,shot.id+'.mp4');await providers.video!.generate(shot.assetPrompt,path);return {path,kind:'video',provider:'ai-video',license:'Provider-generated; user must verify commercial terms',sourceUrl:null,cost:videoCost};});
   if(!selected&&providers.stock)await attempt('stock-video',async()=>{const item=await providers.stock!.search(shot.narration,'video',shot.end-shot.start);if(!item)throw new Error('No relevant stock clip');const path=join(dir,shot.id+'.mp4');await downloadStock(item,path);return {path,kind:'video',provider:'pexels',license:`${item.license}; Credit: ${item.attribution}`,sourceUrl:item.sourceUrl,cost:0};});
   if(!selected&&providers.image&&total+0.07<=profile.assetBudgetUsd)await attempt('generated-image',async()=>{const path=join(dir,shot.id+'.png');await providers.image!.generate(shot.assetPrompt,path);return {path,kind:'image',provider:'openai-image',license:'Original generated image; provider commercial terms apply',sourceUrl:null,cost:0.07};});
   if(!selected&&providers.stock)await attempt('stock-image',async()=>{const item=await providers.stock!.search(shot.narration,'image',0);if(!item)throw new Error('No relevant stock image');const path=join(dir,shot.id+'.jpg');await downloadStock(item,path);return {path,kind:'image',provider:'pexels',license:`${item.license}; Credit: ${item.attribution}`,sourceUrl:item.sourceUrl,cost:0};});
  }
  if(!selected)await attempt('motion-graphic',async()=>{const vector=join(dir,shot.id+'.svg');const path=join(dir,shot.id+'.png');await illustrator.generate(`${shot.id} ${shot.visualIntent}`,vector);await exec('ffmpeg',['-y','-v','error','-i',vector,'-frames:v','1',path],{timeout:20000});return {path,kind:'graphic',provider:'original-editorial',license:'Original runtime illustration, CC0',sourceUrl:null,cost:0};});
  if(!selected)await attempt('kinetic-text',async()=>{const path=join(dir,shot.id+'-kinetic.svg');await writeFile(path,'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><radialGradient id="g"><stop stop-color="#25434e"/><stop offset="1" stop-color="#08121e"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="1400" cy="400" r="260" stroke="#bc955e" stroke-width="4" fill="none"/><path d="M100 800L600 500L1100 750L1750 200" stroke="#649b99" stroke-width="5" fill="none"/></svg>');return {path,kind:'graphic',provider:'kinetic-text',license:'Original kinetic illustration, CC0',sourceUrl:null,cost:0};});
  if(!selected)throw new Error(`All visual fallbacks failed for ${shot.id}; refusing a blank shot`);
  const result=selected as NonNullable<typeof selected>;total+=result.cost;if(result.provider==='ai-video')aiVideoTotal+=result.cost;assets.push({shotId:shot.id,...result,estimatedCost:result.cost,intent:shot.visualIntent,fallbacks:failures,sha256:await fileDigest(result.path)});
 }
 return {assets,estimatedTotalCost:total};
}
