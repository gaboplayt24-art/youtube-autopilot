import {readFile,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {paidCall,currentCosts} from '../cost';
import {LocalTranscriptionProvider} from './kokoro';
import {exec} from '../orchestration/io';
import type {StockProvider,StockAsset,TranscriptionProvider,TTSProvider,Alignment} from './interfaces';
export class PexelsProvider implements StockProvider {
 async search(query:string,kind:'image'|'video',minDuration:number):Promise<StockAsset|null>{
  if(!process.env.PEXELS_API_KEY)throw new Error('PEXELS_API_KEY is missing');
  const url=kind==='video'?`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`:`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`;
  const response=await fetch(url,{headers:{Authorization:process.env.PEXELS_API_KEY},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Pexels HTTP ${response.status}`);const body=await response.json();
  if(kind==='image'){const photo=body.photos?.[0];return photo?{url:photo.src.large2x,kind,license:'Pexels License: https://www.pexels.com/license/',sourceUrl:photo.url,attribution:photo.photographer}:null;}
  const video=body.videos?.find((v:any)=>v.duration>=minDuration);const file=video?.video_files?.filter((f:any)=>f.file_type==='video/mp4'&&f.width>=1920).sort((a:any,b:any)=>a.width-b.width)[0];return file?{url:file.link,kind,license:'Pexels License: https://www.pexels.com/license/',sourceUrl:video.url,attribution:video.user.name}:null;
 }
}
export class WhisperProvider implements TranscriptionProvider {
 async transcribe(path:string,narration:string):Promise<Alignment>{
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is missing');const bytes=await readFile(path);const form=new FormData();form.append('file',new Blob([bytes],{type:'audio/wav'}),'narration.wav');form.append('model','whisper-1');form.append('response_format','verbose_json');form.append('timestamp_granularities[]','word');
  const rate=currentCosts()?.policy.rates.transcriptionPerMinute;if(rate===undefined)throw new Error('Cost context missing');const {duration}=await import('../orchestration/io');
  const r=await paidCall('transcription','whisper',(await duration(path))/60*rate,'word timestamps',()=>fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(120000)}));if(!r.ok)throw new Error(`Whisper HTTP ${r.status}`);
  const body=await r.json();const words=z.array(z.object({word:z.string(),start:z.number(),end:z.number()})).parse(body.words);const tokens=narration.split(/\s+/);const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(words.length!==tokens.length||words.some((w,i)=>normalize(w.word)!==normalize(tokens[i])))throw new Error('Narration/transcription mismatch; review is required');return words.map((w,i)=>({start:w.start,end:w.end,text:tokens[i]}));
 }
}
export class ElevenLabsProvider implements TTSProvider {
 constructor(private transcription:TranscriptionProvider=new LocalTranscriptionProvider(),private voice=process.env.ELEVENLABS_VOICE_ID){}
 async speak(text:string,path:string,context?:import('./interfaces').SpeechContext){
  if(!this.voice||!process.env.ELEVENLABS_API_KEY)throw new Error('ElevenLabs voice/key missing');if(text.length>10000)throw new Error('Eleven v4 chapter exceeds 10,000 characters; split at chapter/sentence boundaries');
  const rate=currentCosts()?.policy.rates.ttsPerThousandCharacters;if(rate===undefined)throw new Error('Cost context missing');
  const response=await paidCall('tts','elevenlabs',text.length/1000*rate,'chapter narration',()=>fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voice!)}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({text,model_id:process.env.ELEVENLABS_MODEL||'eleven_v4',previous_text:context?.previousText,next_text:context?.nextText,pronunciation_dictionary_locators:process.env.ELEVENLABS_PRONUNCIATION_DICTIONARY_ID&&process.env.ELEVENLABS_PRONUNCIATION_DICTIONARY_VERSION?[{pronunciation_dictionary_id:process.env.ELEVENLABS_PRONUNCIATION_DICTIONARY_ID,version_id:process.env.ELEVENLABS_PRONUNCIATION_DICTIONARY_VERSION}]:undefined,voice_settings:{stability:0.5,similarity_boost:0.75,speed:context?.performance?.pace==='slow'?0.92:context?.performance?.pace==='slightly-fast'?1.05:1}}),signal:AbortSignal.timeout(180000)}));
  if(!response.ok)throw new Error(`ElevenLabs HTTP ${response.status}`);const body=await response.json();const mp3=path+'.mp3';await writeFile(mp3,Buffer.from(z.string().parse(body.audio_base64),'base64'));await exec('ffmpeg',['-y','-v','error','-i',mp3,'-ar','48000',path],{timeout:60000});
  // No bracket instructions or SSML are placed in speech text. Pace uses documented voice_settings.speed.
  // Emotions/emphasis remain editorial metadata; unsupported controls are never read aloud.
  const a=body.alignment;let words:Alignment;
  if(a?.characters?.join('')===text){const parsed=z.object({characters:z.array(z.string()),character_start_times_seconds:z.array(z.number().nonnegative()),character_end_times_seconds:z.array(z.number().nonnegative())}).parse(a);if(parsed.characters.length!==parsed.character_start_times_seconds.length||parsed.characters.length!==parsed.character_end_times_seconds.length)throw new Error('ElevenLabs character alignment invalid');words=[...text.matchAll(/\S+/g)].map(t=>({text:t[0],start:parsed.character_start_times_seconds[t.index!],end:parsed.character_end_times_seconds[t.index!+t[0].length-1]}));}
  else words=await this.transcription.transcribe(path,text);
  return {alignment:words,words};
 }
}
export async function downloadStock(asset:StockAsset,path:string){const url=new URL(asset.url);if(url.protocol!=='https:')throw new Error('Media URL must be HTTPS');const res=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!res.ok)throw new Error(`Media download HTTP ${res.status}`);const limit=100*1024*1024;const length=Number(res.headers.get('content-length'));if(length>limit)throw new Error('Media exceeds size budget');const reader=res.body?.getReader();if(!reader)throw new Error('Empty media');const chunks:Buffer[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Media exceeds size budget');}chunks.push(Buffer.from(value));}await writeFile(path,Buffer.concat(chunks));}
