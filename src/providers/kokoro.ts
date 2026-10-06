import {resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {currentQuota} from '../quota';
import {duration} from '../orchestration/io';
import {read} from '../orchestration/io';
import type {TTSProvider,TranscriptionProvider,Alignment,SpeechContext} from './interfaces';
export const normalizeSpeech=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function alignWords(narration:string,chunks:{text:string;timestamp:[number,number|null]}[]):Alignment{
 const tokens=narration.split(/\s+/);if(tokens.length!==chunks.length||tokens.some((t,i)=>normalizeSpeech(t)!==normalizeSpeech(chunks[i].text)))throw new Error('Local transcript differs from script; review pronunciation/text instead of inventing timestamps');
 return chunks.map((c,i)=>{const [start,end]=c.timestamp;if(end===null||end<=start)throw new Error('Local transcription missing timestamp');return {text:tokens[i],start,end};});
}
export async function localTranscript(path:string){const output=path+'.transcript.json';await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'transcribe',path,output},12*60000);return read(output);}
export class LocalTranscriptionProvider implements TranscriptionProvider {
 async transcribe(path:string,narration:string){return alignWords(narration,(await localTranscript(path)).chunks);}
}
export class KokoroProvider implements TTSProvider {
 constructor(private voice=process.env.KOKORO_VOICE||'am_michael',private speed=1,private strictAlignment=true){}
 async speak(text:string,path:string,context?:SpeechContext){const speed=this.speed*(context?.performance?.pace==='slow'?.94:context?.performance?.pace==='slightly-fast'?1.04:1);const quota=currentQuota();const id=await quota?.reserve('local','Kokoro-82M');const output=path+'.transcript.json';await superviseWorker(resolve('src/voice/local-worker.mjs'),{action:'speak',text,path,output,voice:this.voice,speed},12*60000);await quota?.finish(id!,{ttsMinutes:await duration(path)/60});const transcript=await read(output);let words:Alignment=[];try{words=alignWords(text,transcript.chunks);}catch(e){if(this.strictAlignment)throw e;}return {alignment:words,words};}
}
