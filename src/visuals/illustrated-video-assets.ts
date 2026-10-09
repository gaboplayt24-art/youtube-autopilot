import {z} from 'zod';
import {join} from 'node:path';
import type {Shot} from '../editor/schemas';
import {media} from '../editor/schemas';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import {VisualStyleEngine} from './native-v4-2';
import {Runner} from '../orchestration/runner';
import {read} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {inspectIllustrationReuse} from './illustrated-assets-v4';
import {requireIllustratedArtwork,type IllustratedStyleLock} from './illustration-schema';
export function validatePlannedReuse(shots:Shot[]){
 const keys=shots.map(s=>s.assetKey??s.id);if(keys.some((key,i)=>i>0&&key===keys[i-1]))throw new Error('Consecutive identical full scenes are forbidden');
 for(const key of new Set(keys)){const group=shots.filter(s=>(s.assetKey??s.id)===key);if(group.length>4||group.some(s=>s.illustrationIdea?.concept!==group[0].illustrationIdea?.concept))throw new Error('Source reuse must have one consistent scene and at most four meaningful uses');if(group.length>1&&group.some(s=>!s.visualIntent||(!s.overlay&&!s.overlayArrow)))throw new Error('Reused source needs a meaningful editorial reveal, label or arrow');}
 return keys;
}
export async function createIllustratedVideoAssets(shots:Shot[],style:IllustratedStyleLock,reference:string,dir:string,runner:Runner,vision:LLMProvider&VisionProvider,plannedReuse=false){
 const engine=new VisualStyleEngine(),assets=[];if(plannedReuse)validatePlannedReuse(shots);
 const results=new Map<string,Awaited<ReturnType<VisualStyleEngine['generate']>>>();
 for(const shot of shots){if(!shot.illustrationIdea)throw new Error('Full illustrated source IDEA is required, never a primitive SVG scene');const key=plannedReuse?shot.assetKey??shot.id:shot.id;
 let result=results.get(key);if(!result){result=await engine.generate({...shot.illustrationIdea,id:key},style,reference,join(dir,'illustrated-v4.2'),runner,vision,1920,1080);if(!result.review.passed||!result.artwork)throw new Error('Native production illustration QA failed: '+key+' '+JSON.stringify(result.review.objectiveFailures));results.set(key,result);}
 assets.push({shotId:shot.id,path:result.source.path,sha256:result.source.sha256,kind:'image' as const,provider:'cloudflare-flux-free',sourceImageId:key,sourceSha256:result.source.sha256,editorialVariant:shot.visualIntent,license:'AI-generated original FLUX illustration; Apache-2.0 model and Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,intent:shot.narration+'; '+shot.visualIntent,fallbacks:[],artwork:result.artwork});}
 const reuse=inspectIllustrationReuse([...results.entries()].map(([id,result])=>({id,sha256:result.source.sha256})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
export async function loadIllustratedFixtures(shots:Shot[]){
 const path=process.env.ILLUSTRATED_ASSET_MANIFEST;if(!path)throw new Error('API-free demo needs an approved v4 illustrated fixture manifest. Never generate geometry as fallback.');
 const fixtures=z.object({humanApproved:z.literal(true),narrationByShot:z.record(z.string()),media}).parse(await read(path));
 const assets=shots.map(shot=>{const asset=fixtures.media.assets.find(a=>a.shotId===shot.id);if(!asset||fixtures.narrationByShot[shot.id]!==shot.narration)throw new Error('Approved demo artwork does not match this narration');requireIllustratedArtwork(asset);return asset;});
 for(const asset of assets)if(await fileDigest(asset.path)!==asset.sha256)throw new Error('Approved demo fixture checksum changed');
 const reuse=inspectIllustrationReuse(assets.map(a=>({id:a.shotId,sha256:a.sourceSha256!})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
