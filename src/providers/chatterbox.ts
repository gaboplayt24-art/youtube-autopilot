import {mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {alignWords,localTranscript} from './kokoro';
import {duration} from '../orchestration/io';
import {currentQuota} from '../quota';
import type {TTSProvider} from './interfaces';
export class ChatterboxNanoProvider implements TTSProvider {
 constructor(private strictAlignment=true){}
 async speak(text:string,path:string){await mkdir(dirname(path),{recursive:true});const quota=currentQuota();const id=await quota?.reserve('local','ResembleAI/chatterbox-nano');try{await superviseWorker(resolve('scripts/cpu-worker.mjs'),{action:'nano',text,path,reference:null},15*60000);await quota?.finish(id!,{ttsMinutes:await duration(path)/60});const transcript=await localTranscript(path);let words:ReturnType<typeof alignWords>=[];try{words=alignWords(text,transcript.chunks);}catch(e){if(this.strictAlignment)throw e;}return {alignment:words,words};}catch(e){if(id)await quota?.finish(id,{},true);throw e;}}
}
