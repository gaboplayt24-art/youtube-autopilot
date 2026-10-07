import {mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {superviseWorker} from '../render/supervisor';
import {validatedVoiceAlignment} from './kokoro';
import {duration,read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {currentQuota} from '../quota';
import {extractCriticalTerms} from '../voice/qa';
import type {TTSProvider,SpeechContext} from './interfaces';
export class ChatterboxNanoProvider implements TTSProvider {
 constructor(private strictAlignment=true,private referenceAudioPath?:string,private model:'nano'|'turbo'='nano'){}
 async speak(text:string,path:string,context?:SpeechContext){await mkdir(dirname(path),{recursive:true});const quota=currentQuota();const version='nano-71ccd1d-code5de7a54-pauses180ms';const checkpoint=path+'.synthesis.json';let cached=false;
  const reference=context?.referenceAudioPath??this.referenceAudioPath;const referenceSha256=reference?await fileDigest(reference):null;const selectedVersion=this.model==='turbo'?'turbo-71ccd1d-reference-v1':version;
  try{const previous=await read(checkpoint);if(previous.text!==text||previous.version!==selectedVersion||previous.referenceSha256!==referenceSha256||previous.sha256!==await fileDigest(path))throw new Error('Chatterbox synthesis checkpoint changed; use a new run ID');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await json(path+'.critical-terms.json',{text,criticalTerms:extractCriticalTerms(text,context?.criticalTerms)});
  if(!cached){const id=await quota?.reserve('local',this.model==='turbo'?'ResembleAI/chatterbox-turbo':'ResembleAI/chatterbox-nano');try{await superviseWorker(resolve('scripts/cpu-worker.mjs'),{action:this.model,text,path,reference:reference??null},this.model==='turbo'?25*60000:15*60000,metrics=>{void json(path+'.metrics.json',metrics);});await json(checkpoint,{text,version:selectedVersion,referenceSha256,referenceAudioPath:reference??null,sha256:await fileDigest(path)});if(id)await quota?.finish(id,{ttsMinutes:await duration(path)/60});}catch(e){if(id)await quota?.finish(id,{},true);throw e;}}
  // Save synthesis before ASR: alignment failures must not regenerate narration.
  const words=this.strictAlignment?await validatedVoiceAlignment(path,text,context?.criticalTerms,context?.allowVoiceReview===true):[];
  return {alignment:words,words};
 }
}
export class ChatterboxTurboProvider extends ChatterboxNanoProvider {constructor(strictAlignment=true,referenceAudioPath?:string){super(strictAlignment,referenceAudioPath,'turbo');}}
