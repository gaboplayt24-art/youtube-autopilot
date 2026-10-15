import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {applyHumanASRReview} from '../src/voice/human-asr-review';
import {evaluateVoice} from '../src/voice/qa';
const text='The seraphim in the vision';
const raw={text:'The set of time in the vision',model:'Whisper Small',chunks:[{text:'The',timestamp:[0,.2] as [number,number]},{text:'set',timestamp:[.2,.4] as [number,number]},{text:'of',timestamp:[.4,.5] as [number,number]},{text:'time',timestamp:[.5,.8] as [number,number]},{text:'in the vision',timestamp:[.8,2] as [number,number]}]};
const review={audioFile:'narration-chapter-2.wav',wavSha256:'a'.repeat(64),transcriptSha256:'b'.repeat(64),scriptSha256:createHash('sha256').update(text).digest('hex'),confirmation:'si esta bien',confirmationQuestion:'Can you hear seraphim clearly in this actual excerpt?',confirmationSource:'Explicit channel owner reply',listeningArtifact:'https://example.org/actual-clip.mp3',sourceExecution:'123',corrections:[{referenceTokenIndex:1,firstChunk:1,observedChunks:raw.chunks.slice(1,4),heardWord:'seraphim'}]};
const binding={wavSha256:review.wavSha256,transcriptSha256:review.transcriptSha256};
test('explicit human word evidence preserves raw ASR and uses a whole measured interval without invented times',()=>{
 const snapshot=JSON.stringify(raw),result=applyHumanASRReview(text,raw,review,binding);
 assert.equal(result.transcript.text,text);assert.equal(JSON.stringify(raw),snapshot);
 assert.deepEqual(result.transcript.chunks[1],{text:'seraphim',timestamp:[.2,.8]});
 assert.equal(result.evidence.applied.length,1);
});
test('review cannot apply to changed audio, script, recognition or overlapping spans',()=>{
 assert.throws(()=>applyHumanASRReview(text,raw,review,{...binding,wavSha256:'c'.repeat(64)}),/hash mismatch/);
 assert.throws(()=>applyHumanASRReview(text+' changed',raw,review,binding),/hash mismatch/);
 assert.throws(()=>applyHumanASRReview(text,raw,review,{...binding,transcriptSha256:'d'.repeat(64)}),/hash mismatch/);
 assert.throws(()=>applyHumanASRReview(text,raw,{...review,corrections:[{...review.corrections[0],observedChunks:[{text:'other',timestamp:[.2,.8]}]}]},binding),/original measured chunks/);
 assert.throws(()=>applyHumanASRReview(text,raw,{...review,corrections:[review.corrections[0],review.corrections[0]]},binding),/Overlapping/);
 assert.throws(()=>applyHumanASRReview(text,raw,{...review,corrections:[{...review.corrections[0],heardWord:'cherubim'}]},binding),/expected script token/);
});
test('a human-confirmed word does not waive other critical factual errors',()=>{
 const result=applyHumanASRReview(text,raw,review,binding);
 const policy={passWer:.02,reviewWer:.05,maxSkippedPhraseWords:3,maxUnexpectedPauseSeconds:2.5,maxPauseSeconds:8,discontinuityThreshold:.45,benchmarkMinSeconds:60,benchmarkMaxSeconds:90,qwenMaxProbeSeconds:300,qwenMaxRealTimeFactor:8,qwenMaxPeakMemoryMb:5500};
 const changed={...result.transcript,text:result.transcript.text.replace('vision','prison')};
 const report=evaluateVoice(text,changed,['seraphim','vision'],policy);
 assert.equal(report.status,'fail');assert.equal(report.criticalChecks.find(c=>c.term==='vision')?.passed,false);
});
