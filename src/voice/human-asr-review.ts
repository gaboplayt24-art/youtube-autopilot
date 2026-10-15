import {createHash} from 'node:crypto';
import {copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {z} from 'zod';
import {read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {normalizedTokens,type Transcript} from './qa';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const chunk=z.object({text:z.string(),timestamp:z.tuple([z.number().nonnegative(),z.number().nonnegative()])});
const correction=z.object({referenceTokenIndex:z.number().int().nonnegative(),firstChunk:z.number().int().nonnegative(),observedChunks:z.array(chunk).min(1).max(8),heardWord:z.string().min(1).max(80).refine(w=>normalizedTokens(w).length===1,'Only one owner-confirmed lexical token per correction')});
export const humanASRReview=z.object({audioFile:z.string().regex(/^narration-chapter-[0-9]+[.]wav$/),wavSha256:hash,transcriptSha256:hash,scriptSha256:hash,confirmation:z.string().min(3),confirmationQuestion:z.string().min(20),confirmationSource:z.string().min(10),listeningArtifact:z.string().url(),sourceExecution:z.string().regex(/^[0-9]+$/),corrections:z.array(correction).min(1).max(8)});
const envelope=z.object({version:z.literal(1),runId:z.string().regex(/^[A-Za-z0-9_-]+$/),scope:z.string().min(10),reviews:z.array(humanASRReview).min(1)});
export function applyHumanASRReview(script:string,raw:Transcript,input:unknown,bindings:{wavSha256:string;transcriptSha256:string}){
 const review=humanASRReview.parse(input);
 if(review.wavSha256!==bindings.wavSha256||review.transcriptSha256!==bindings.transcriptSha256||review.scriptSha256!==createHash('sha256').update(script).digest('hex'))throw new Error('Human ASR review source hash mismatch; correction refused');
 const reference=normalizedTokens(script),occupied=new Set<number>();
 for(const c of review.corrections){
  if(reference[c.referenceTokenIndex]?.text!==normalizedTokens(c.heardWord)[0].text)throw new Error('Human-reviewed word is not the expected script token');
  const measured=raw.chunks.slice(c.firstChunk,c.firstChunk+c.observedChunks.length);
  if(JSON.stringify(measured)!==JSON.stringify(c.observedChunks))throw new Error('Human ASR review does not match the original measured chunks');
  for(let i=0;i<measured.length;i++){
   const at=c.firstChunk+i,t=measured[i].timestamp;
   if(occupied.has(at)||t[1]===null||t[1]<=t[0]||i>0&&t[0]<measured[i-1].timestamp[1]!)throw new Error('Overlapping or invalid human-reviewed measured intervals');
   occupied.add(at);
  }
 }
 const starts=new Map(review.corrections.map(c=>[c.firstChunk,c]));
 const chunks:Transcript['chunks']=[];
 for(let i=0;i<raw.chunks.length;i++){
  const c=starts.get(i);
  if(c){const last=raw.chunks[i+c.observedChunks.length-1];chunks.push({text:c.heardWord,timestamp:[raw.chunks[i].timestamp[0],last.timestamp[1]]});i+=c.observedChunks.length-1;}
  else chunks.push(raw.chunks[i]);
 }
 return {transcript:{...raw,text:chunks.map(c=>c.text.trim()).join(' '),chunks,model:(raw.model??'Whisper')+' + explicit owner-confirmed word review'},evidence:{review,originalModel:raw.model??null,rawTranscriptPreserved:true,timingMethod:'Union of the original contiguous ASR intervals; no word boundary interpolation',applied:review.corrections.map(c=>({referenceTokenIndex:c.referenceTokenIndex,heardWord:c.heardWord,observed:c.observedChunks,start:c.observedChunks[0].timestamp[0],end:c.observedChunks.at(-1)!.timestamp[1]}))}};
}
/** An approval is eligible only for this run, audio filename and exact immutable source bytes. */
export async function reviewedPrimaryTranscript(path:string,script:string){
 const runDir=dirname(dirname(resolve(path)));
 if(dirname(runDir)!==resolve('data/runs'))return null;
 const runId=basename(runDir);let input:unknown;
 try{input=await read(join('data/scripts',runId+'-voice-asr-review.json'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 const record=envelope.parse(input);if(record.runId!==runId)throw new Error('Human ASR review run mismatch');
 const review=record.reviews.find(r=>r.audioFile===basename(path));if(!review)return null;
 const transcriptPath=path+'.small.transcript.json',raw=await read(transcriptPath) as Transcript;
 const result=applyHumanASRReview(script,raw,review,{wavSha256:await fileDigest(path),transcriptSha256:await fileDigest(transcriptPath)});
 for(const suffix of ['.voice-QA.json','.normalized-comparison.json','.diff.json']){try{await copyFile(path+suffix,path+'.pre-human-review'+suffix,constants.COPYFILE_EXCL);}catch(e){if(!['ENOENT','EEXIST'].includes((e as NodeJS.ErrnoException).code??''))throw e;}}
 await json(path+'.human-reviewed.transcript.json',result.transcript);
 await json(path+'.human-review-application.json',result.evidence);
 return {primary:result.transcript,raw,evidencePath:path+'.human-review-application.json'};
}
