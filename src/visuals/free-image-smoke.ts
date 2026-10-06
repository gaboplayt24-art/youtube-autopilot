import {parseArgs} from 'node:util';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Runner} from '../orchestration/runner';
import {json,read,exec} from '../orchestration/io';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {CloudflareWorkersAIImageProvider} from '../providers/cloudflare';
import {createHistoricalAssets} from './ai-assets';
import {visualBible,historicalPrompt} from './bible';
import {z} from 'zod';
import {media,profile,shot} from '../editor/schemas';
import {composition} from '../orchestration/schemas';
import {renderPreview} from '../render';
import {fileDigest} from '../orchestration/integrity';
import {copyFile} from 'node:fs/promises';
const {values}=parseArgs({options:{'run-id':{type:'string',default:'free-image-smoke'},prepare:{type:'boolean',default:false}}});
async function main(){const id=values['run-id']!;if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid run ID');const dir=join('data/runs',id);await mkdir(dir,{recursive:true});const runner=new Runner(dir);await runner.lock();const costs=new CostLedger(await loadCostPolicy(),dir),quota=new FreeQuotaLedger(dir);await costs.restore();await quota.restore();
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
 const bible=visualBible.parse({era:'200 BCE',location:'imagined eastern Mediterranean port',architecture:'limestone quays, stone warehouses, courtyard colonnades',characters:[{id:'merchant',description:'adult male in plain cream linen tunic, dark curly hair'}],clothing:'undyed linen and wool, simple leather sandals',materials:'stone, wood, linen, papyrus, clay, bronze',lighting:'soft dawn sunlight, mist over water',camera:'low eye-level wide establishing frame',lens:'35mm',colorGrade:'muted amber highlights and cool blue shadows',realism:'cinematic plausible historical reconstruction',filmTexture:'subtle fine grain',forbiddenAnachronisms:['electric lights','plastic','modern cranes','modern ships','modern text'],disclosure:'AI historical reconstruction; not archival evidence'});
 await json(join(dir,'visual-bible.json'),bible);
 const planned=shot.parse({id:'harbor',sceneId:'s1',start:0,end:3,narration:'An imagined ancient harbor at dawn.',visualIntent:'Ancient merchant inspecting linen beside a wooden boat, stone harbor and mist at dawn',shotType:'generated-image',motion:'pan-left',assetPrompt:'One merchant folding linen beside a wooden boat on a limestone quay. Visible ancient harbor architecture and warm dawn mist, no text.',overlay:null,keywords:['harbor','linen'],highImpact:true,transition:'cut',editorialReframe:1});
 const folder=join(dir,'assets',planned.id+'-depth'),raw=join(folder,'flux.png'),prompt=historicalPrompt(bible,planned.assetPrompt);await mkdir(folder,{recursive:true});
 const image=await runner.stage('image',z.object({path:z.string(),sha256:z.string().length(64)}),async()=>{await costs.charge('generatedImages','cloudflare-flux-free',0,planned.id,()=>new CloudflareWorkersAIImageProvider().generate(prompt,raw));return {path:raw,sha256:await fileDigest(raw)};},async result=>{if(result.sha256!==await fileDigest(result.path))throw new Error('Image checkpoint integrity failure');});
 await json(join(folder,'image-checkpoint.json'),{prompt,sha256:image.sha256,model:'@cf/black-forest-labs/flux-1-schnell',license:'Apache-2.0 model; Cloudflare/BFL terms apply'});
 if(values.prepare)return;
 const assets=await runner.stage('assets',media,()=>createHistoricalAssets([planned],bible,join(dir,'assets'),new CloudflareWorkersAIImageProvider()),async result=>{for(const a of result.assets)if(a.sha256!==await fileDigest(a.path))throw new Error('Image integrity failure');});
 const pub=join('public',id);await mkdir(pub,{recursive:true});for(const a of assets.assets){await copyFile(a.path,join(pub,a.shotId+'.png'));for(const [name,path]of Object.entries(a.depthLayers!))await copyFile(path,join(pub,a.shotId+'-'+name+'.png'));}
 const props=composition.parse({width:1920,height:1080,fps:30,durationInFrames:90,scenes:[],shots:[planned],cues:[],visualProfile:profile.parse(await read('config/visual-profiles/history.json')),assets:assets.assets.map(a=>({...a,path:`${id}/${a.shotId}.png`,depthLayers:Object.fromEntries(Object.keys(a.depthLayers!).map(k=>[k,`${id}/${a.shotId}-${k}.png`]))}))});
 await json(join(dir,'composition.json'),props);for(const frame of [0,45,89])await renderPreview(props,join(dir,`frame-${frame}.png`),frame);
 const probe=await exec('ffprobe',['-v','error','-show_streams','-of','json',assets.assets[0].path]);await json(join(dir,'image-probe.json'),JSON.parse(probe.stdout));
 await json(join(dir,'technical-summary.json'),{technicalChecksPassed:true,provider:'cloudflare-flux-free',model:'@cf/black-forest-labs/flux-1-schnell',depthModel:'Depth Anything V2 Small',paidProviderCostUsd:0,imageCount:1,semanticQARun:false,productionApproved:false,testFixture:true,note:'Independent image/depth/camera test with an original fixed bible; not a Gemini-authored video or semantic quality approval.'});
 }));}finally{await costs.report();await quota.report();await runner.unlock();}}
main().catch(e=>{console.error(JSON.stringify({event:'free_image_smoke_failed',message:e.message}));process.exitCode=1;});
