import {writeFile} from 'node:fs/promises';
import factory from '@echogarden/espeak-ng-emscripten';
import type {TTSProvider} from '../providers/interfaces';
// Real speech synthesis, isolated per call; GPL dependency used only in demo.
export class DemoVoice implements TTSProvider {
 async speak(text:string,path:string){
  const module=await factory();const worker=new module.eSpeakNGWorker();worker.set_voice('en-us');worker.set_rate(135);
  const chunks:Int16Array[]=[];const words:{position:number;time:number}[]=[];worker.synthesize(text,(samples,events)=>{if(samples.length)chunks.push(samples);for(const e of events)if(e.type==='word')words.push({position:e.text_position-1,time:e.audio_position/1000});});
  const rate=worker.get_samplerate();const count=chunks.reduce((n,c)=>n+c.length,0);if(!count)throw new Error('Speech synthesis returned no audio');
  const buffer=Buffer.alloc(44+count*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);let offset=44;for(const c of chunks)for(const sample of c){buffer.writeInt16LE(sample,offset);offset+=2;}await writeFile(path,buffer);module.destroy(worker);
  const tokens=[...text.matchAll(/\S+/g)];const timed=tokens.map((token,i)=>{const at=token.index!;const event=words.find(w=>w.position>=at&&w.position<at+token[0].length);const previous=words.filter(w=>w.position<=at).at(-1);const next=words.find(w=>w.position>at);const start=event?.time??((previous?.time??0)+(next?.time??count/rate))/2;return {start,end:0,text:token[0],index:i};});
  for(let i=0;i<timed.length;i++){timed[i].start=Math.max(i?timed[i-1].start+0.001:0,timed[i].start);timed[i].end=timed[i+1]?.start??count/rate;}
  const alignment=[];for(let i=0;i<timed.length;i+=3){const group=timed.slice(i,i+3);alignment.push({start:group[0].start,end:group.at(-1)!.end,text:group.map(w=>w.text).join(' ')});}if(!alignment.length)throw new Error('No speech timing events');return {alignment,words:timed.map(({start,end,text})=>({start,end,text}))};
 }
}
