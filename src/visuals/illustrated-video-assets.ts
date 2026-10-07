import {z} from 'zod';
import {join} from 'node:path';
import type {Shot} from '../editor/schemas';
import {media} from '../editor/schemas';
import type {LLMProvider,VisionProvider} from '../providers/interfaces';
import {CloudflareWorkersAIImageProvider} from '../providers/cloudflare';
import {Runner} from '../orchestration/runner';
import {read} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {generateIllustration,inspectIllustrationReuse} from './illustrated-assets-v4';
import {requireIllustratedArtwork,type IllustratedStyleLock} from './illustration-schema';
export async function createIllustratedVideoAssets(shots:Shot[],style:IllustratedStyleLock,reference:string,dir:string,runner:Runner,vision:LLMProvider&VisionProvider){
 const image=new CloudflareWorkersAIImageProvider(),assets=[];
 for(const shot of shots){if(!shot.illustrationIdea)throw new Error('Full illustrated source IDEA is required, never a primitive SVG scene');const result=await generateIllustration(shot.illustrationIdea,style,reference,join(dir,'illustrated-v4'),runner,image,vision);assets.push({shotId:shot.id,path:result.framedPath,sha256:result.framedSha256,kind:'image' as const,provider:'cloudflare-flux-free',sourceImageId:shot.id,sourceSha256:result.source.sha256,license:'AI-generated original FLUX illustration; Apache-2.0 model and Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,intent:shot.narration+'; '+shot.illustrationIdea.concept,fallbacks:[],artwork:result.artwork});}
 const reuse=inspectIllustrationReuse(assets.map(a=>({id:a.shotId,sha256:a.sourceSha256})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
export async function loadIllustratedFixtures(shots:Shot[]){
 const path=process.env.ILLUSTRATED_ASSET_MANIFEST;if(!path)throw new Error('API-free demo needs an approved v4 illustrated fixture manifest. Never generate geometry as fallback.');
 const fixtures=z.object({humanApproved:z.literal(true),narrationByShot:z.record(z.string()),media}).parse(await read(path));
 const assets=shots.map(shot=>{const asset=fixtures.media.assets.find(a=>a.shotId===shot.id);if(!asset||fixtures.narrationByShot[shot.id]!==shot.narration)throw new Error('Approved demo artwork does not match this narration');requireIllustratedArtwork(asset);return asset;});
 for(const asset of assets)if(await fileDigest(asset.path)!==asset.sha256)throw new Error('Approved demo fixture checksum changed');
 const reuse=inspectIllustrationReuse(assets.map(a=>({id:a.shotId,sha256:a.sourceSha256!})));if(!reuse.passed)throw new Error(reuse.issues.join('; '));return media.parse({assets,estimatedTotalCost:0});
}
