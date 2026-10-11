import {z} from 'zod';
import {join} from 'node:path';
import type {Composition} from '../orchestration/schemas';
import {composition as compositionSchema,metadata as metadataSchema,localizations as localizationsSchema} from '../orchestration/schemas';
import {renderVideo} from '../render';
import {duration,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {inspectAudio} from '../audio/qa';

// Owner-authorized 2026-10-11: every QA-passed video also yields one vertical Short cut from its own opening beats.
export const SHORT_MAX_SECONDS=58;
export const SHORT_MIN_SECONDS=20;
export const shortWindow=compositionSchema.shape.short.unwrap();
export const shortRendered=z.object({path:z.string(),duration:z.number().positive(),sha256:z.string().length(64),width:z.literal(1080),height:z.literal(1920),window:shortWindow,metadata:metadataSchema});
const SHORTS_TAG=' #Shorts';
/** Short title: the approved title (or a ranked alternative) with the #Shorts marker, within YouTube's 100-character limit. */
export function shortTitle(title:string){const base=title.trim().replace(/\s*#shorts\b/i,'');return (base.length+SHORTS_TAG.length>100?base.slice(0,100-SHORTS_TAG.length).replace(/\s+\S*$/,''):base)+SHORTS_TAG;}
/** Opening window that ends on a beat whose narration closes a sentence, so the Short never cuts mid-sentence. */
export function chooseShortWindow(shots:{start:number;end:number;narration:string}[],max=SHORT_MAX_SECONDS,min=SHORT_MIN_SECONDS){
 const ordered=[...shots].sort((a,b)=>a.start-b.start);const fits=ordered.filter(s=>s.end<=max&&s.end>=min);
 const sentence=fits.filter(s=>/[.!?]["')\]]?\s*$/.test(s.narration.trim()));const pick=(sentence.length?sentence:fits).at(-1);
 if(!pick)throw new Error(`No beat boundary between ${min}s and ${max}s for a Short`);return {startSeconds:0,endSeconds:pick.end};
}
/** Source and credit lines are kept from the approved long-video description; the full-video link is added at upload, once its ID exists. */
export function shortDescription(m:{description:string},hook:string,videoUrl:string){const sources=m.description.split('\n').filter(l=>/^https?:\/\//.test(l.trim()));return `${hook}\n\n▶ Full story: ${videoUrl}\n\n${sources.length?'Sources:\n'+sources.join('\n')+'\n\n':''}Narration is synthesized; illustrations are original AI-generated artwork.\n#Shorts #Bible #History #Archaeology`.slice(0,5000);}
export function shortLocalizations(loc:z.infer<typeof localizationsSchema>,videoUrl:string){return {defaultLanguage:loc.defaultLanguage,items:Object.fromEntries(Object.entries(loc.items).map(([lang,item])=>[lang,{title:shortTitle(item.title),description:`${item.title}\n\n▶ ${videoUrl}\n\n#Shorts`}]))};}
export async function renderShort(composition:Composition,window:z.infer<typeof shortWindow>,m:z.infer<typeof metadataSchema>,dir:string){
 const path=join(dir,'short.mp4');const fps=composition.fps;
 await renderVideo({...composition,width:1080,height:1920,durationInFrames:Math.round((window.endSeconds-window.startSeconds)*fps),short:window},path);
 const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path])).stdout).streams as {codec_type:string;width?:number;height?:number}[];const v=probe.find(s=>s.codec_type==='video');
 if(v?.width!==1080||v.height!==1920||!probe.some(s=>s.codec_type==='audio'))throw new Error('Short must be 1080x1920 with audio');
 const seconds=await duration(path);if(seconds<SHORT_MIN_SECONDS-1||seconds>60)throw new Error(`Short duration ${seconds}s outside ${SHORT_MIN_SECONDS}–60s`);
 // The Short reuses the QA-passed mix; its own encoded loudness and peaks are still measured before any upload.
 const audio=await inspectAudio(path,{expectedDuration:seconds});if(!audio.passed)throw new Error('Short audio QA failed; upload blocked');
 return shortRendered.parse({path,duration:seconds,sha256:await fileDigest(path),width:1080,height:1920,window,metadata:{...m,title:window.title}});
}
