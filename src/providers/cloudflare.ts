import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {dirname,basename} from 'node:path';
import {z} from 'zod';
import {extractCriticalTerms} from '../voice/qa';
import {cloudflareRun as run,type CloudflareRetryOptions} from './cloudflare-request';
import {exec,json,duration,log} from '../orchestration/io';
import {validatedVoiceAlignment} from './kokoro';
import type {ImageProvider,TTSProvider,SpeechContext,ImageContext} from './interfaces';
export const KLEIN_PRODUCTION_SIZE={width:2048,height:1152} as const;
export function validateKleinNativeSize(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<256||height<256||width>2048||height>2048||width*9!==height*16||width%16||height%16)throw new Error('Klein native 16:9 dimensions must be aligned to 16-pixel blocks within 256–2048; 1920x1080 is a final render size, not a supported inference grid');}
export const FLUX_REFERENCE_MODEL='@cf/black-forest-labs/flux-2-klein-4b';
export const FLUX_MODEL='@cf/black-forest-labs/flux-1-schnell';
export const MELO_MODEL='@cf/myshell-ai/melotts';
export function cloudflareConfigured(){return !!process.env.CLOUDFLARE_ACCOUNT_ID&&!!process.env.CLOUDFLARE_API_TOKEN;}
/** Official REST schema accepts prompt/steps only, outputs a 1024-square base64 image. */
export class CloudflareWorkersAIImageProvider implements ImageProvider {
 constructor(private request:typeof fetch=fetch,private retryOptions:CloudflareRetryOptions={}){}
 async generate(prompt:string,path:string){if(prompt.length>2048)throw new Error('FLUX prompt exceeds 2048 chars');const {response,id,quota,attempt}=await run(FLUX_MODEL,{prompt,steps:4},64,this.request,this.retryOptions);try{const result=z.object({success:z.literal(true),result:z.object({image:z.string().min(16)})}).parse(await response.json());await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(result.result.image,'base64'));await exec('ffmpeg',['-v','error','-i',path,'-frames:v','1','-f','null','-'],{timeout:20000});await quota.finish(id,{images:1});await log(quota.dir,'cloudflare_image_returned',{model:FLUX_MODEL,attempt,httpStatus:response.status,imageReturned:true});}catch(e){await quota.finish(id,{},true);throw e;}}
}
/** Official Klein multipart contract: reference inputs must be smaller than 512 square. */
export class CloudflareReferenceImageProvider implements ImageProvider {
 constructor(private request:typeof fetch=fetch){}
 async generate(prompt:string,path:string,context?:ImageContext){
  if(prompt.length>2048)throw new Error('FLUX prompt exceeds 2048 chars');
  const references=context?.referenceImages??[];if(!references.length&&!context?.referenceFreeAudition)throw new Error('Klein primary illustration requires actual input_image_0 reference');if(references.length>4)throw new Error('FLUX Klein accepts at most four references');
  await mkdir(dirname(path),{recursive:true});const form=new FormData();form.append('prompt',prompt);const width=context?.width??KLEIN_PRODUCTION_SIZE.width,height=context?.height??KLEIN_PRODUCTION_SIZE.height;validateKleinNativeSize(width,height);form.append('width',String(width));form.append('height',String(height));
  for(const [index,reference]of references.entries()){
   const resized=path+`.reference-${index}.png`;const ref=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',reference])).stdout).streams[0];const factor=Math.min(1,504/Math.max(ref.width,ref.height));const refWidth=Math.max(1,Math.round(ref.width*factor)),refHeight=Math.max(1,Math.round(ref.height*factor));let bytes:Buffer,mime:string;if(factor===1){bytes=await readFile(reference);mime=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'image/png':'image/jpeg';}else{await exec('ffmpeg',['-y','-v','error','-i',reference,'-vf',`scale=${refWidth}:${refHeight}`,'-frames:v','1',resized],{timeout:20000});bytes=await readFile(resized);mime='image/png';}
   form.append(`input_image_${index}`,new Blob([new Uint8Array(bytes)],{type:mime}),`reference-${index}.${mime==='image/png'?'png':'jpg'}`);
  }
  // Output/input 512px tiles rounded upward to 32 neurons each; reservation, not measured usage.
  const {response,id,quota}=await run(FLUX_REFERENCE_MODEL,form,Math.ceil(width/512)*Math.ceil(height/512)*32+references.length*32,this.request);
  let decodedImage=false;
  try{const result=z.object({success:z.literal(true),result:z.object({image:z.string().min(16)})}).parse(await response.json());await writeFile(path,Buffer.from(result.result.image,'base64'));await exec('ffmpeg',['-v','error','-i',path,'-frames:v','1','-f','null','-'],{timeout:20000});decodedImage=true;const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path])).stdout).streams[0];await json(path+'.dimensions.json',{width:probe.width,height:probe.height,requestedWidth:width,requestedHeight:height,model:FLUX_REFERENCE_MODEL});if(probe.width!==width||probe.height!==height)throw new Error('Klein returned wrong native dimensions; no square crop fallback');await quota.finish(id,{images:1});await log(quota.dir,'cloudflare_image_returned',{model:FLUX_REFERENCE_MODEL,httpStatus:response.status,imageReturned:true,width,height});}
  catch(e){await quota.finish(id,decodedImage?{images:1}:{},true);throw e;}
 }
}
export class MeloTTSProvider implements TTSProvider {
 constructor(private request:typeof fetch=fetch,private strictAlignment=true){}
 async speak(text:string,path:string,context?:SpeechContext){
  await mkdir(dirname(path),{recursive:true});await json(path+'.critical-terms.json',{text,criticalTerms:extractCriticalTerms(text,context?.criticalTerms)});
  const chunks:string[]=[];for(const sentence of text.match(/[^.!?]+[.!?]*/g)??[text]){const last=chunks.at(-1);if(last&&last.length+sentence.length+1<=950)chunks[chunks.length-1]=last+' '+sentence.trim();else {if(sentence.trim().length>950)throw new Error('Melo sentence exceeds 950 characters');chunks.push(sentence.trim());}}
  const started=performance.now();const parts:string[]=[];
  for(let i=0;i<chunks.length;i++){const {response,id,quota}=await run(MELO_MODEL,{prompt:chunks[i],lang:'en'},128,this.request);try{const bytes=response.headers.get('content-type')?.includes('json')?Buffer.from(z.object({success:z.literal(true),result:z.object({audio:z.string()})}).parse(await response.json()).result.audio,'base64'):Buffer.from(await response.arrayBuffer());const part=path+`.part-${i+1}.wav`;await writeFile(part+'.mp3',bytes);await exec('ffmpeg',['-y','-v','error','-i',part+'.mp3','-ar','48000','-ac','1',part],{timeout:30000});const minutes=await duration(part)/60;if(minutes*18.63>128)throw new Error('MeloTTS exceeded conservative reservation; review quota');await quota.finish(id,{ttsMinutes:minutes});parts.push(part);}catch(e){await quota.finish(id,{},true);throw e;}}
  const list=path+'.concat.txt';await writeFile(list,parts.map(p=>`file '${basename(p)}'`).join('\n'));await exec('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',list,'-c:a','pcm_s16le',path],{timeout:60000});await json(path+'.metrics.json',{elapsedSeconds:(performance.now()-started)/1000,peakMemoryMb:null,method:'Remote Melo inference: server memory is not exposed; elapsed time includes requests and lossless concatenation',chunks});
  const words=this.strictAlignment?await validatedVoiceAlignment(path,text,context?.criticalTerms):[];return {alignment:words,words};
 }
}
