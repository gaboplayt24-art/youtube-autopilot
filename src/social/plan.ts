import {z} from 'zod';
import type {Composition} from '../orchestration/schemas';
export const candidate=z.object({id:z.string().regex(/^[A-Z]$/),title:z.string().min(5).max(80),source:z.string(),narration:z.string().min(20)});
export const chapterClipSelection=z.object({runId:z.string(),chapters:z.array(candidate.omit({narration:true}).extend({sceneId:z.string().min(1)})).min(3).max(5)}).superRefine((value,ctx)=>{
 const n=value.chapters.length;if(new Set(value.chapters.map(c=>c.id)).size!==n||new Set(value.chapters.map(c=>c.sceneId)).size!==n)ctx.addIssue({code:'custom',message:'Select distinct clips and chapters'});
});
const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export type ScriptScenes={title:string;scenes:{id:string;claims?:{text:string}[]}[]};
const REFERENCE=/\b((?:[1-3] )?[A-Z][a-z]+ \d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?)/;
/** Without an editorial selection: up to five chapters after the hook (owner 2026-10-29: Shorts bring most views), titled by their chapter card or the episode title,
 * each cited to the passage its own approved claims reference. Times still come only from measured words. */
export function automaticChapterSelection(runId:string,composition:Composition,script:ScriptScenes,titles:Record<string,string>):z.infer<typeof chapterClipSelection>{
 const scenes=composition.scenes.map(s=>s.id).filter(id=>composition.cues.some(c=>c.sceneId===id)).slice(1,6);
 if(scenes.length<3)throw Error('Automatic Shorts need three narrated chapters after the hook');
 return {runId,chapters:scenes.map((sceneId,i)=>{
  const claims=script.scenes.find(s=>s.id===sceneId)?.claims??[];const source=claims.map(c=>c.text.match(REFERENCE)?.[1]).find(Boolean)??'The biblical text';
  const card=titles[sceneId];const title=(card??`${script.title} (${i+1}/${scenes.length})`).slice(0,80);
  return {id:'ABCDE'[i],sceneId,title:title.length>=5?title:script.title.slice(0,80),source};
 })};
}
/** Editorial candidates from the first complete measured sentences of approved chapters; never invented times. */
export function chapterClipCandidates(selection:z.infer<typeof chapterClipSelection>,composition:Composition){
 return chapterClipSelection.parse(selection).chapters.map(({id,title,source,sceneId})=>{
  const words=composition.cues.filter(c=>c.sceneId===sceneId).flatMap(c=>c.words??[]);
  if(!words.length)throw Error('Measured chapter words missing: '+sceneId);
  let end=-1,best=Infinity;
  words.forEach((word,i)=>{
   const seconds=word.end-words[0].start;
   if(seconds<20||seconds>40||!/[.!?]["')\]]?$/.test(word.text))return;
   const distance=Math.abs(seconds-30);if(distance<best){end=i;best=distance;}
  });
  if(end<0)throw Error('No complete measured 20-40 second passage: '+sceneId);
  const result=candidate.parse({id,title,source,narration:words.slice(0,end+1).map(w=>w.text).join(' ')});
  planClip(result,composition); // Keep the existing uniqueness, timestamp and coverage gates.
  return result;
 });
}
/** Locate complete measured words in the FINAL frame-rounded timeline, not raw chapter-WAV offsets. */
export function planClip(input:z.input<typeof candidate>,composition:Composition){
 const c=candidate.parse(input),words=composition.cues.flatMap(c=>c.words??[]),tokens=c.narration.split(/\s+/).map(normalize).filter(Boolean);
 // A measured "word" can hold several spoken tokens ("three hundred"): match token by token, mapped back to whole words.
 const flat=words.flatMap((w,index)=>w.text.split(/\s+/).map(normalize).filter(Boolean).map((token,k,all)=>({token,index,first:k===0,last:k===all.length-1})));
 const matches:number[]=[];
 for(let i=0;i<=flat.length-tokens.length;i++)if(flat[i].first&&flat[i+tokens.length-1].last&&tokens.every((t,j)=>flat[i+j].token===t))matches.push(i);
 if(matches.length!==1)throw Error('Clip narration must match one unique measured passage');
 const selected=words.slice(flat[matches[0]].index,flat[matches[0]+tokens.length-1].index+1),start=selected[0].start,end=selected.at(-1)!.end;
 if(end-start<15||end-start>60)throw Error('Clip must be a complete 15–60 second passage');
 if(selected.some((w,i)=>w.end<=w.start||i>0&&w.start<selected[i-1].end-.02))throw Error('Invalid measured word times');
 const shots=composition.shots.filter(s=>s.end>start&&s.start<end).map(s=>({...s,start:Math.max(s.start,start)-start,end:Math.min(s.end,end)-start,editorialTiming:undefined,overlay:null}));
 if(!shots.length||Math.abs(shots[0].start)>.04||Math.abs(shots.at(-1)!.end-(end-start))>.04||shots.some((s,i)=>i>0&&Math.abs(s.start-shots[i-1].end)>.04))throw Error('Clip has a visual coverage gap');
 const shifted=selected.map(w=>({...w,start:w.start-start,end:w.end-start}));
 const cues:Composition['cues']=[];for(let i=0;i<shifted.length;i+=4){const group=shifted.slice(i,i+4);cues.push({sceneId:'clip',start:group[0].start,end:group.at(-1)!.end,text:group.map(w=>w.text).join(' '),words:group});}
 return {id:c.id,title:c.title,source:c.source,narration:c.narration,start,end,duration:end-start,shots,cues};
}
export function releaseSlots(mainPublishAt:string,now=new Date()){
 const at=Date.parse(mainPublishAt);if(!Number.isFinite(at)||at+3600000<now.getTime()+3*3600000)throw Error('Main release must leave at least three hours to process the first clip');
 return [0,1,2,3,4].map(day=>({youtube:new Date(at+day*86400000+3600000).toISOString(),tiktok:new Date(at+day*86400000+5400000).toISOString()}));
}
