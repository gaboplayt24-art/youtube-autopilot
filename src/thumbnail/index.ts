import {copyFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {z} from 'zod';
import type {Composition} from '../orchestration/schemas';
import type {LLMProvider} from '../providers/interfaces';
import {renderThumbnail} from '../render';
import {fileDigest} from '../orchestration/integrity';
import {exec} from '../orchestration/io';

/** Design rubric; subjective scores are not audience or CTR predictions. */
export function thumbnailScores(words:number,fontSize:number,contrast:number,context?:{hook:string;title:string;focalContrast:number}){
 const normalize=(s:string)=>s.toLowerCase().replace(/\W+/g,' ').trim();
 const hook=context?.hook??'';const title=context?.title??'';
 return {clarity:words>=0&&words<=4?95:40,mobileReadability:fontSize>=80?95:40,contrast:contrast>=7?95:40,subjectProminence:Math.round(Math.min(100,(context?.focalContrast??.1)/.12*100)),curiosity:/\?/.test(hook)?90:/^(choose|one|why|how|where|what)\b/i.test(hook)?84:70,titleComplementarity:hook&&normalize(hook)===normalize(title)?40:84};
}
function luminance(r:number,g:number,b:number){
 const linear=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 return .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
}
export async function inspectThumbnail(path:string,hook:string,title:string,allowSubjectiveReview=false,doodle=false){
 const probe=await exec('ffprobe',['-v','error','-show_streams','-of','json',path]);
 const image=JSON.parse(probe.stdout).streams[0];
 // Sample the text backing without glyphs: below the title for the dark cinematic band, the label panel's top padding for doodle thumbnails.
 const pixels=await exec('ffmpeg',['-v','error','-i',path,'-vf',doodle?'scale=1280:720,crop=240:8:60:51,scale=64:8':'scale=1280:720,crop=400:50:80:600,scale=64:8','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'],{encoding:'buffer',timeout:20000});
 let background=0;for(let i=0;i<pixels.stdout.length;i+=3)background+=luminance(pixels.stdout[i],pixels.stdout[i+1],pixels.stdout[i+2]);
 background/=pixels.stdout.length/3;
 const foreground=doodle?luminance(48,42,37):luminance(241,192,115);
 const ratio=(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
 const focal=await exec('ffmpeg',['-v','error','-i',path,'-vf','scale=1280:720,crop=1120:560:80:80,scale=112:56','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'],{encoding:'buffer',timeout:20000});
 const values=[];for(let i=0;i<focal.stdout.length;i+=3)values.push(luminance(focal.stdout[i],focal.stdout[i+1],focal.stdout[i+2]));
 const mean=values.reduce((a,b)=>a+b,0)/values.length;const focalContrast=Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/values.length);
 const scores=thumbnailScores(hook.split(/\s+/).length,93,ratio,{hook,title,focalContrast});
 if(image.width!==3840||image.height!==2160||!allowSubjectiveReview&&([scores.clarity,scores.mobileReadability,scores.contrast].some(s=>s<70)||scores.subjectProminence<30))throw new Error('Thumbnail failed dimensions/readability/contrast/focal-visibility QA: '+JSON.stringify({path,hook,width:image.width,height:image.height,textBackingLuminance:background,contrastRatio:ratio,focalContrast,scores}));
 return scores;
}
export async function thumbnails(c:Composition,dir:string,llm?:LLMProvider,approvedTexts?:string[],allowSubjectiveReview=false){
 const hook=z.string().trim().min(0).max(28).refine(s=>s.split(/\s+/).length<=4);
 const plan=approvedTexts?z.object({texts:z.array(hook).length(3)}).parse({texts:approvedTexts}):llm?await llm.json(`Create 3 truthful thumbnail hooks complementing this approved title: ${c.thumbnailTitle}. Return {texts:[string,string,string]}. Each is 1-4 words, <=28 characters, no unsupported claims. Original narration: ${c.scenes.map(s=>s.text).join(' ')}`,z.object({texts:z.array(hook).length(3)})):{texts:['WHO GETS THE LIGHT?','ONE CLEAR PATH','CHOOSE YOUR FOCUS']};
 // A channel using only B-roll still needs a real focal subject on its thumbnail.
 let props=c;
 if(!c.assets.some(a=>a.kind!=='video')){
  const first=c.assets[0];if(!first)throw new Error('Thumbnail requires a focal asset');
  const path=join(dirname(first.path),'thumbnail-focal.png');
  await exec('ffmpeg',['-y','-v','error','-ss','1','-i',join('public',first.path),'-frames:v','1',join('public',path)],{timeout:30000});
  props={...c,assets:[{...first,path,kind:'image',sha256:await fileDigest(join('public',path))}]};
 }
 const variants=[];
 for(const variant of ['A','B','C'] as const){
  const path=join(dir,`thumbnail-${variant}.png`);const title=plan.texts[variants.length];
  await renderThumbnail({...props,thumbnailVariant:variant,thumbnailTitle:title},path);
  const scores=await inspectThumbnail(path,title,c.thumbnailTitle??'',allowSubjectiveReview,c.assets.some(a=>a.artwork?.styleVersion==='illustrated-doodle-v4.2'));
  variants.push({variant,path,sha256:await fileDigest(path),scores});
 }
 const primary=variants[0];const selected=join(dir,'thumbnail.png');await copyFile(primary.path,selected);
 return {path:selected,variant:primary.variant,sha256:primary.sha256,variants};
}
