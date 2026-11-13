import {join} from 'node:path';
import {z} from 'zod';
import {voice,plan} from '../orchestration/schemas';
import type {TTSProvider} from '../providers/interfaces';
import {exec,duration,json,read} from '../orchestration/io';
import {extractCriticalTerms} from './qa';
import {fileDigest} from '../orchestration/integrity';
import {copyFile} from 'node:fs/promises';
/** Owner-maintained respellings (config/pronunciations.json); absent file means none. */
export async function verifiedPronunciations(path='config/pronunciations.json'):Promise<PronunciationTerm[]>{try{return pronunciations.parse(await read(path)).terms;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
export type PronunciationTerm={term:string;replacement:string|null;verified:boolean};
const escape=(t:string)=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Respell only the verified terms whose critical check failed, longest first and on word boundaries ("Anak" never touches "Anakim"). */
export function respell(text:string,failed:string[],dictionary:PronunciationTerm[]){
 const changes=dictionary.filter(t=>t.verified&&t.replacement&&t.replacement!==t.term&&failed.includes(t.term)).sort((a,b)=>b.term.length-a.term.length);
 let out=text;for(const t of changes)out=out.replace(new RegExp('(?<![A-Za-z])'+escape(t.term)+'(?![A-Za-z])','g'),t.replacement!);
 return {text:out,changes:out===text?[]:changes};
}
/** A Voice QA failure on critical names is re-synthesized ONCE from a verified respelling and judged against the
 * ORIGINAL text by the unchanged gate; the original take and its evidence are kept. */
async function pronunciationRepair(error:unknown,tts:TTSProvider,text:string,path:string,context:Record<string,unknown>,dictionary:PronunciationTerm[]){
 if(!/^Voice QA FAIL/.test((error as Error).message??''))throw error;
 const qa=await read(path+'.voice-QA.json').catch(()=>null) as {criticalChecks?:{term:string;passed:boolean}[]}|null;
 const failed=[...new Set((qa?.criticalChecks??[]).filter(c=>!c.passed).map(c=>c.term))];
 const {text:synthesisText,changes}=respell(text,failed,dictionary);if(!changes.length)throw error;
 const repair=path.replace(/\.wav$/,'-pronunciation-repair.wav');
 const spoken=await tts.speak(text,repair,{...context,synthesisText});
 for(const suffix of ['','.voice-QA.json','.normalized-comparison.json','.diff.json'])await copyFile(path+suffix,path+'.original'+suffix).catch(()=>undefined);
 for(const suffix of ['','.voice-QA.json','.normalized-comparison.json','.diff.json'])await copyFile(repair+suffix,path+suffix).catch(()=>undefined);
 await json(path+'.pronunciation-repair.json',{original:text,synthesisText,changes,failedTerms:failed,rawRepair:repair,originalTakePreserved:path+'.original'});
 return spoken;
}
export const pronunciations=z.object({terms:z.array(z.object({term:z.string().min(1),category:z.enum(['people','places','Latin','Greek','Egyptian','dates','dynasties','foreign names']),replacement:z.string().nullable(),verified:z.boolean(),source:z.string().nullable()}))});
export function pronunciationCandidates(text:string){const terms=[...new Set(text.match(/\b(?:[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})?|\d{3,4}\s*(?:BC|BCE|AD|CE))\b/g)??[])].filter(t=>!['Imagine','Every','Tonight','Messages','Follow','Pause','Now','One','The','Turn','Put','Choose','Write','There','This','What'].includes(t));return pronunciations.parse({terms:terms.map(term=>({term,category:/\d/.test(term)?'dates':'foreign names',replacement:null,verified:false,source:null}))});}
// Long audio generations precede visual segmentation. Scene WAVs are lossless slices, NOT TTS calls.
/** ASR boundary jitter: a word may start up to 150 ms before the previous one ends ("a" 20.66-20.86, "gourd"
 * 20.80-21.16 in bible-jonah-004). Such overlaps meet at their midpoint; larger ones still fail the timing check.
 * The raw transcript stays in the sidecar and each settled index is recorded. */
export function settleWordOverlaps<W extends {text:string;start:number;end:number}>(raw:W[],limit=.15){
 const words=raw.map(w=>({...w})),settled:number[]=[];
 for(let i=1;i<words.length;i++){const a=words[i-1],b=words[i],overlap=a.end-b.start;
  if(overlap>.02&&overlap<=limit){const mid=Math.round((a.end+b.start)/2*1000)/1000;if(mid>a.start&&mid<b.end){a.end=mid;b.start=mid;settled.push(i);}}}
 return {words,settled};
}
export async function narrateChapters(p:z.infer<typeof plan>,tts:TTSProvider,dir:string,wpm=140,identity='demo',performancePlans:Record<string,any>={},criticalTerms:string[]=[],dictionary:PronunciationTerm[]=[]){
 const groups:typeof p.scenes[]=[];let group:typeof p.scenes=[];let count=0;
 for(const scene of p.scenes){const words=scene.narration.split(/\s+/).length;if(group.length&&(count+words>wpm*6||group.map(s=>s.narration).join(' ').length+scene.narration.length>9500)){groups.push(group);group=[];count=0;}if(scene.narration.length>9500)throw new Error('Narrative chapter exceeds provider limit; revise chapter plan');group.push(scene);count+=words;if(count>=wpm*3){groups.push(group);group=[];count=0;}}if(group.length)groups.push(group);
 const result:z.infer<typeof voice>={scenes:[],chapters:[]};
 for(let index=0;index<groups.length;index++){const chapter=groups[index];const text=chapter.map(s=>s.narration).join(' ');const path=join(dir,`narration-chapter-${index+1}.wav`);const sidecar=path+'.json';const expectedTerms=extractCriticalTerms(text,criticalTerms);await json(path+'.critical-terms.json',{text,criticalTerms:expectedTerms});let spoken!:{alignment:import('../providers/interfaces').Alignment;words?:import('../providers/interfaces').Alignment};let cached=false;try{const data=await read(sidecar);if(data.text!==text||data.identity!==identity||data.sha256!==await fileDigest(path))throw new Error('Narration checkpoint identity/text/hash mismatch');if(JSON.stringify(data.criticalTerms)===JSON.stringify(expectedTerms)){spoken=data.spoken;cached=true;}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(!cached){const context={previousText:groups[index-1]?.map(s=>s.narration).join(' '),nextText:groups[index+1]?.map(s=>s.narration).join(' '),criticalTerms:expectedTerms,performance:performancePlans[chapter[0].id]};try{spoken=await tts.speak(text,path,context);}catch(error){spoken=await pronunciationRepair(error,tts,text,path,context,dictionary);}}
 const raw=spoken.words??spoken.alignment;if(!raw.length)throw new Error('Narration has no measured ASR spans');const {words,settled}=settleWordOverlaps(raw);const seconds=await duration(path);const badTiming=words.findIndex((w,i)=>w.start<0||w.end<=w.start||w.end>seconds+.1||i>0&&w.start<words[i-1].end-.02);if(badTiming>=0)throw new Error('Invalid chapter measured timing: '+JSON.stringify({path,seconds,index:badTiming,word:words[badTiming],previous:words[badTiming-1]??null}));if(!cached)await json(sidecar,{text,identity,spoken,settledOverlaps:settled,criticalTerms:expectedTerms,sha256:await fileDigest(path)});
 result.chapters!.push({id:`narration-chapter-${index+1}`,path,duration:seconds,identity,words});let tokenOffset=0;let start=0;
 for(let i=0;i<chapter.length;i++){const s=chapter[i];const size=s.narration.split(/\s+/).length;let stop=tokenOffset,count=0;while(count<size&&stop<words.length)count+=words[stop++].text.split(/\s+/).length;if(count!==size)throw new Error('Measured ASR phrase crosses scene boundary; revise segmentation instead of guessing timestamps');const slice=words.slice(tokenOffset,stop);const end=i===chapter.length-1?seconds:words[stop].start;const scenePath=join(dir,s.id+'.wav');await exec('ffmpeg',['-y','-v','error','-i',path,'-af',`atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS`,'-ar','48000',scenePath],{timeout:60000});const aligned=slice.map(w=>({...w,start:Math.max(0,w.start-start),end:Math.min(end-start,w.end-start)}));result.scenes.push({id:s.id,path:scenePath,duration:await duration(scenePath),alignment:aligned,words:aligned});start=end;tokenOffset=stop;}
 }
 return voice.parse(result);
}
