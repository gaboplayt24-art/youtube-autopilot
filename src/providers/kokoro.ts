import {resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {currentQuota} from '../quota';
import {duration,json} from '../orchestration/io';
import {evaluateVoice,loadVoiceQAPolicy,extractCriticalTerms,requireVoiceQA,measuredReferenceAlignment,saveVoiceEvidence,type Transcript} from '../voice/qa';
import {read} from '../orchestration/io';
import type {TTSProvider,TranscriptionProvider,Alignment,SpeechContext} from './interfaces';
export const normalizeSpeech=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function alignWords(narration:string,chunks:{text:string;timestamp:[number,number|null]}[]):Alignment{
 const tokens=narration.split(/\s+/),spoken=chunks.filter(c=>normalizeSpeech(c.text).length>0);
 if(!spoken.length||tokens.map(normalizeSpeech).join('')!==spoken.map(c=>normalizeSpeech(c.text)).join(''))throw new Error('Local transcript differs from script; review pronunciation/text instead of inventing timestamps');
 // Orthographic tokenization can differ (stonewalls / stone walls, sea-side / sea side).
 // Group into short measured phrases at shared character boundaries, never split
 // one ASR interval into invented individual word timings.
 const measured:Alignment=[];let token=0,chunk=0;
 while(token<tokens.length&&chunk<spoken.length){const firstToken=token++,firstChunk=chunk++;let expected=normalizeSpeech(tokens[firstToken]),heard=normalizeSpeech(spoken[firstChunk].text);
  while(expected!==heard){if(expected.length<heard.length&&token<tokens.length)expected+=normalizeSpeech(tokens[token++]);else if(chunk<spoken.length)heard+=normalizeSpeech(spoken[chunk++].text);else throw new Error('Local transcript differs from script');}
  const spans=spoken.slice(firstChunk,chunk);for(const c of spans)if(c.timestamp[1]===null||c.timestamp[1]<c.timestamp[0]||c.timestamp[0]<0)throw new Error('Local transcription missing timestamp');
  measured.push({text:tokens.slice(firstToken,token).join(' '),start:spans[0].timestamp[0],end:spans.at(-1)!.timestamp[1]!});
 }
 if(token!==tokens.length||chunk!==spoken.length)throw new Error('Local transcript differs from script');
 const aligned:Alignment=[];
 for(let i=0;i<measured.length;i++){let unit={...measured[i]};while(unit.end===unit.start&&i+1<measured.length){const next=measured[++i];unit={text:unit.text+' '+next.text,start:Math.min(unit.start,next.start),end:Math.max(unit.end,next.end)};}
  if(unit.end===unit.start){const previous=aligned.pop();if(!previous)throw new Error('Local transcription missing timestamp');unit={text:previous.text+' '+unit.text,start:previous.start,end:Math.max(previous.end,unit.end)};}
  if(unit.end<=unit.start)throw new Error('Local transcription missing timestamp');aligned.push(unit);
 }
 return aligned;
}
export async function localTranscript(path:string,model='Xenova/whisper-tiny.en'){const output=path+(model==='Xenova/whisper-tiny.en'?'.transcript.json':model==='Xenova/whisper-base.en'?'.base.transcript.json':'.small.transcript.json');await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'transcribe',path,output,model},12*60000);return read(output);}
/** Retry transcription, never speech synthesis or invented word boundaries. */
export async function alignWithASRFallback(narration:string,transcribe:(model:string)=>Promise<{chunks:{text:string;timestamp:[number,number|null]}[]}>):Promise<Alignment>{
 const policy=await loadVoiceQAPolicy();const terms=extractCriticalTerms(narration);const transcripts:Transcript[]=[];let last:unknown;
 for(const model of ['Xenova/whisper-tiny.en','Xenova/whisper-base.en','Xenova/whisper-small.en']){const raw=await transcribe(model);const transcript={...raw,text:raw.chunks.map(c=>c.text.trim()).join(' ')};transcripts.push(transcript);try{requireVoiceQA(evaluateVoice(narration,transcript,terms,policy,transcripts.slice(0,-1)));return measuredReferenceAlignment(narration,transcript);}catch(e){last=e;}}
 throw last;
}
export async function validatedVoiceAlignment(path:string,text:string,declared:string[]=[]){
 const terms=extractCriticalTerms(text,declared);await json(path+'.critical-terms.json',{criticalTerms:terms,text});
 const primary=await localTranscript(path,'Xenova/whisper-small.en');const alternatives:Transcript[]=[];
 if(evaluateVoice(text,primary,terms,await loadVoiceQAPolicy()).normalizedComparison.differences.length)alternatives.push(await localTranscript(path,'Xenova/whisper-base.en'));
 const report=await saveVoiceEvidence(path,text,primary,terms,alternatives);requireVoiceQA(report);return measuredReferenceAlignment(text,primary);
}
export class LocalTranscriptionProvider implements TranscriptionProvider {
 async transcribe(path:string,narration:string){return validatedVoiceAlignment(path,narration);}
}
export class KokoroProvider implements TTSProvider {
 constructor(private voice=process.env.KOKORO_VOICE||'am_michael',private speed=1,private strictAlignment=true){}
 async speak(text:string,path:string,context?:SpeechContext){const speed=this.speed*(context?.performance?.pace==='slow'?.94:context?.performance?.pace==='slightly-fast'?1.04:1);const quota=currentQuota();const id=await quota?.reserve('local','Kokoro-82M');await json(path+'.critical-terms.json',{text,criticalTerms:extractCriticalTerms(text,context?.criticalTerms)});await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'speak',text,path,output:path+'.synthesis.json',voice:this.voice,speed,transcribe:false},12*60000,metrics=>{void json(path+'.metrics.json',metrics);});await quota?.finish(id!,{ttsMinutes:await duration(path)/60});const words=this.strictAlignment?await validatedVoiceAlignment(path,text,context?.criticalTerms):[];return {alignment:words,words};}
}
