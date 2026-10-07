import {exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import type {z} from 'zod';
import type {acceptedIllustration} from './illustrated-assets-v4';
export async function removeIllustratedBackground(source:z.infer<typeof acceptedIllustration>,output:string,python=process.env.REMBG_PYTHON??'.venv-rembg/bin/python'){
 if(!source.review.passed||source.artwork.generationMethod!=='ai-illustration'||source.source.sha256!==await fileDigest(source.source.path))throw new Error('Background removal accepts only verified AI illustrations');
 await exec(python,['scripts/remove-art-background.py','--input',source.source.path,'--output',output],{timeout:180000});
 return {path:output,sha256:await fileDigest(output),sourceSha256:source.source.sha256,method:'rembg/u2net local CPU',paidCostUsd:0};
}
