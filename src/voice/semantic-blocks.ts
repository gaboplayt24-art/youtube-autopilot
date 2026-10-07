import {join} from 'node:path';
import {copyFile} from 'node:fs/promises';
import type {z} from 'zod';
import {voice,plan} from '../orchestration/schemas';
import {duration,json,read} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {ChatterboxNanoProvider} from '../providers/chatterbox';
import {validatedVoiceAlignment} from '../providers/kokoro';
import {extractCriticalTerms} from './qa';
export async function narrateSemanticBlocks(p:z.infer<typeof plan>,dir:string,reference:string,pronunciations:{terms:{term:string;replacement:string|null;verified:boolean}[]}):Promise<z.infer<typeof voice>>{
 const result:z.infer<typeof voice>={scenes:[],chapters:[]};
 for(const scene of p.scenes){const path=join(dir,scene.id+'.wav'),sidecar=path+'.block.json';let words:import('../providers/interfaces').Alignment;const identity=await fileDigest(reference);try{const saved=await read(sidecar);if(saved.text!==scene.narration||saved.referenceSha256!==identity||saved.sha256!==await fileDigest(path))throw new Error('Semantic narration checkpoint changed');words=saved.words;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const terms=extractCriticalTerms(scene.narration);try{const spoken=await new ChatterboxNanoProvider(true,reference).speak(scene.narration,path,{criticalTerms:terms,allowVoiceReview:true});words=spoken.words!;}catch(error){
  const qa=await read(path+'.voice-QA.json').catch(()=>null);const failed=qa?.criticalChecks?.filter((c:any)=>!c.passed).map((c:any)=>c.term)??[];const changes=pronunciations.terms.filter(t=>failed.includes(t.term)&&t.verified&&t.replacement);if(!changes.length)throw error;let corrected=scene.narration;for(const t of changes)corrected=corrected.replaceAll(t.term,t.replacement!);const repair=join(dir,scene.id+'-pronunciation-repair.wav');await new ChatterboxNanoProvider(false,reference).speak(corrected,repair);words=await validatedVoiceAlignment(repair,scene.narration,terms,true);await json(path+'.repair.json',{original:scene.narration,synthesisText:corrected,changes,rawRepair:repair});await copyFile(path,path+'.original.wav');await copyFile(repair,path);for(const suffix of [".voice-QA.json",".normalized-comparison.json",".diff.json"]){await copyFile(path+suffix,path+".original"+suffix);await copyFile(repair+suffix,path+suffix);}
 }await json(sidecar,{text:scene.narration,referenceSha256:identity,sha256:await fileDigest(path),words});}
 const seconds=await duration(path);result.scenes.push({id:scene.id,path,duration:seconds,alignment:words,words});result.chapters!.push({id:scene.id,path,duration:seconds,identity:'chatterbox-nano:narrator-reference:audio_prompt_path',words});
 }return voice.parse(result);
}
