import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {z} from 'zod';
import {requireQuota,QuotaPause} from '../quota';
import {exec,json,duration} from '../orchestration/io';
import {alignWords,alignWithASRFallback,localTranscript} from './kokoro';
import type {ImageProvider,TTSProvider} from './interfaces';
export const FLUX_MODEL='@cf/black-forest-labs/flux-1-schnell';
export const MELO_MODEL='@cf/myshell-ai/melotts';
export function cloudflareConfigured(){return !!process.env.CLOUDFLARE_ACCOUNT_ID&&!!process.env.CLOUDFLARE_API_TOKEN;}
async function run(model:string,input:unknown,neurons:number,request:typeof fetch){
 if(!cloudflareConfigured())throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required');
 if(process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true')throw new Error('Confirm Workers FREE plan with CLOUDFLARE_FREE_PLAN_CONFIRMED=true. Paid accounts are refused to prevent overflow from concurrent external usage.');
 const quota=requireQuota();const id=await quota.reserve('cloudflare',model,neurons);
 try{const response=await request(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/ai/run/${model}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});
 if(!response.ok){if(response.status===429){const reset=new Date();reset.setUTCHours(24,0,0,0);await json(quota.dir+'/quota-checkpoint.json',{state:'paused_quota',resumeAfter:reset.toISOString(),paidFallback:false});throw new QuotaPause(reset.toISOString());}throw new Error(`Cloudflare HTTP ${response.status}`);}
 return {response,id,quota};}catch(e){await quota.finish(id,{},true);throw e;}
}
/** Official REST schema accepts prompt/steps only, outputs a 1024-square base64 image. */
export class CloudflareWorkersAIImageProvider implements ImageProvider {
 constructor(private request:typeof fetch=fetch){}
 async generate(prompt:string,path:string){if(prompt.length>2048)throw new Error('FLUX prompt exceeds 2048 chars');const {response,id,quota}=await run(FLUX_MODEL,{prompt,steps:4},64,this.request);try{const result=z.object({success:z.literal(true),result:z.object({image:z.string().min(16)})}).parse(await response.json());await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(result.result.image,'base64'));await exec('ffmpeg',['-v','error','-i',path,'-frames:v','1','-f','null','-'],{timeout:20000});await quota.finish(id,{images:1});}catch(e){await quota.finish(id,{},true);throw e;}}
}
export class MeloTTSProvider implements TTSProvider {
 constructor(private request:typeof fetch=fetch,private strictAlignment=true){}
 async speak(text:string,path:string){if(text.length>1000)throw new Error('MeloTTS free adapter accepts <=1000 characters per call to bound neuron usage');const {response,id,quota}=await run(MELO_MODEL,{prompt:text,lang:'en'},128,this.request);try{const bytes=response.headers.get('content-type')?.includes('json')?Buffer.from(z.object({success:z.literal(true),result:z.object({audio:z.string()})}).parse(await response.json()).result.audio,'base64'):Buffer.from(await response.arrayBuffer());await mkdir(dirname(path),{recursive:true});await writeFile(path+'.mp3',bytes);await exec('ffmpeg',['-y','-v','error','-i',path+'.mp3','-ar','48000','-ac','1',path],{timeout:30000});const minutes=await duration(path)/60;if(minutes*18.63>128)throw new Error('MeloTTS exceeded conservative reservation; review quota before continuing');await quota.finish(id,{ttsMinutes:minutes});let words:ReturnType<typeof alignWords>=[];if(this.strictAlignment)words=await alignWithASRFallback(text,model=>localTranscript(path,model));else {const transcript=await localTranscript(path);try{words=alignWords(text,transcript.chunks);}catch{/* Audition reports WER instead of inventing timestamps. */}}return {alignment:words,words};}catch(e){await quota.finish(id,{},true);throw e;}}
}
