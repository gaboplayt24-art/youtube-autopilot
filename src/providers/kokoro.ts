import {resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {currentQuota} from '../quota';
import {duration} from '../orchestration/io';
import {read} from '../orchestration/io';
import type {TTSProvider,TranscriptionProvider,Alignment,SpeechContext} from './interfaces';
export const normalizeSpeech=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function alignWords(narration:string,chunks:{text:string;timestamp:[number,number|null]}[]):Alignment{
 const tokens=narration.split(/\s+/);if(tokens.length!==chunks.length||tokens.some((t,i)=>normalizeSpeech(t)!==normalizeSpeech(chunks[i].text)))throw new Error('Local transcript differs from script; review pronunciation/text instead of inventing timestamps');
 const measured=chunks.map((c,i)=>{const [start,end]=c.timestamp;if(end===null||end<start||start<0)throw new Error('Local transcription missing timestamp');return {text:tokens[i],start,end};});
 const aligned:Alignment=[];
 for(let i=0;i<measured.length;i++){let unit={...measured[i]};while(unit.end===unit.start&&i+1<measured.length){const next=measured[++i];unit={text:unit.text+' '+next.text,start:Math.min(unit.start,next.start),end:Math.max(unit.end,next.end)};}
  if(unit.end===unit.start){const previous=aligned.pop();if(!previous)throw new Error('Local transcription missing timestamp');unit={text:previous.text+' '+unit.text,start:previous.start,end:Math.max(previous.end,unit.end)};}
  if(unit.end<=unit.start)throw new Error('Local transcription missing timestamp');aligned.push(unit);
 }
 return aligned;
}
export async function localTranscript(path:string,model='Xenova/whisper-tiny.en'){const output=path+(model==='Xenova/whisper-tiny.en'?'.transcript.json':'.base.transcript.json');await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'transcribe',path,output,model},12*60000);return read(output);}
/** Retry transcription, never speech synthesis or invented word boundaries. */
export async function alignWithASRFallback(narration:string,transcribe:(model:string)=>Promise<{chunks:{text:string;timestamp:[number,number|null]}[]}>):Promise<Alignment>{
 const first=await transcribe('Xenova/whisper-tiny.en');
 try{return alignWords(narration,first.chunks);}catch{return alignWords(narration,(await transcribe('Xenova/whisper-base.en')).chunks);}
}
export class LocalTranscriptionProvider implements TranscriptionProvider {
 async transcribe(path:string,narration:string){return alignWithASRFallback(narration,model=>localTranscript(path,model));}
}
export class KokoroProvider implements TTSProvider {
 constructor(private voice=process.env.KOKORO_VOICE||'am_michael',private speed=1,private strictAlignment=true){}
 async speak(text:string,path:string,context?:SpeechContext){const speed=this.speed*(context?.performance?.pace==='slow'?.94:context?.performance?.pace==='slightly-fast'?1.04:1);const quota=currentQuota();const id=await quota?.reserve('local','Kokoro-82M');const output=path+'.transcript.json';await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'speak',text,path,output,voice:this.voice,speed},12*60000);await quota?.finish(id!,{ttsMinutes:await duration(path)/60});const transcript=await read(output);let words:Alignment=[];try{words=alignWords(text,transcript.chunks);}catch(e){if(this.strictAlignment)throw e;}return {alignment:words,words};}
}
