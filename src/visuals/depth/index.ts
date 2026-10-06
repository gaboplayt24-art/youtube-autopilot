import {mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {superviseWorker} from '../../render/supervisor';
import {fileDigest} from '../../orchestration/integrity';
import {read,json} from '../../orchestration/io';
export type DepthLayers={foreground:string;midground:string;background:string;depth:string};
export async function estimateDepth(path:string,output:string):Promise<DepthLayers>{
 await mkdir(output,{recursive:true});const sha=await fileDigest(path);const layers={foreground:join(output,'foreground.png'),midground:join(output,'midground.png'),background:join(output,'background.png'),depth:join(output,'depth.png')};let cached=false;
 try{const checkpoint=await read(join(output,'checkpoint.json'));if(checkpoint.sourceSha!==sha)throw new Error('Depth source changed; choose a new checkpoint');for(const key of Object.keys(layers) as (keyof DepthLayers)[])if(checkpoint.hashes[key]!==await fileDigest(layers[key]))throw new Error('Depth layer checksum mismatch');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(!cached){await access(path);await superviseWorker(resolve('scripts/cpu-worker.mjs'),{action:'depth',path,output},5*60000);await json(join(output,'checkpoint.json'),{sourceSha:sha,model:'Depth Anything V2 Small ONLY',license:'Apache-2.0',hashes:Object.fromEntries(await Promise.all(Object.entries(layers).map(async([k,p])=>[k,await fileDigest(p)])))});}
 return layers;
}
