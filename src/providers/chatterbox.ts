import {mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {alignWords,alignWithASRFallback,localTranscript} from './kokoro';
import {duration,read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {currentQuota} from '../quota';
import type {TTSProvider} from './interfaces';
export class ChatterboxNanoProvider implements TTSProvider {
 constructor(private strictAlignment=true){}
 async speak(text:string,path:string){await mkdir(dirname(path),{recursive:true});const quota=currentQuota();const version='nano-71ccd1d-code5de7a54-pauses180ms';const checkpoint=path+'.synthesis.json';let cached=false;
  try{const previous=await read(checkpoint);if(previous.text!==text||previous.version!==version||previous.sha256!==await fileDigest(path))throw new Error('Nano synthesis checkpoint changed; use a new run ID');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(!cached){const id=await quota?.reserve('local','ResembleAI/chatterbox-nano');try{await superviseWorker(resolve('scripts/cpu-worker.mjs'),{action:'nano',text,path,reference:null},15*60000);await json(checkpoint,{text,version,sha256:await fileDigest(path)});await quota?.finish(id!,{ttsMinutes:await duration(path)/60});}catch(e){if(id)await quota?.finish(id,{},true);throw e;}}
  // Save synthesis before ASR: alignment failures must not regenerate narration.
  let words:ReturnType<typeof alignWords>=[];
  if(this.strictAlignment)words=await alignWithASRFallback(text,model=>localTranscript(path,model));
  else {const transcript=await localTranscript(path);try{words=alignWords(text,transcript.chunks);}catch{/* Audition reports independent WER; it never supplies guessed timings. */}}
  return {alignment:words,words};
 }
}
