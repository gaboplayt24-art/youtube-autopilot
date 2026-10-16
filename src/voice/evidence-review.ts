/** Export actual measured voice evidence; never approves a video or calls a provider. */
import {reviewedPrimaryTranscript} from './human-asr-review';
import {mkdir,readdir,copyFile,writeFile,appendFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {z} from 'zod';
import {read,json,exec,duration} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {loadEditorialDraft} from '../script';
import {script as scriptSchema,facts as factsSchema} from '../orchestration/schemas';
import {evaluateVoice,extractCriticalTerms,loadVoiceQAPolicy,type Transcript} from './qa';
const identity=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const runId=identity.parse(process.env.RUN_ID),execution=identity.parse((process.env.GITHUB_RUN_ID??'local')+'-attempt-'+(process.env.GITHUB_RUN_ATTEMPT??'1'));
const root=join('data/runs',runId),assets=join(root,'assets');
const output=resolve(process.env.REVIEW_OUTPUT_DIR??join('.cache','voice-evidence',runId+'-'+execution));
await mkdir(output,{recursive:true});
const script=scriptSchema.parse(await read(join(root,'script.json')));
const facts=factsSchema.parse(await read(join(root,'facts.json')));
const editorial=await loadEditorialDraft(runId,false),policy=await loadVoiceQAPolicy();
const parts=[];const sourceTexts:string[]=[];
for(const name of (await readdir(assets)).filter(n=>/^narration-chapter-[0-9]+[.]wav$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
 const path=join(assets,name),sha256=await fileDigest(path);
 const synthesis=z.object({text:z.string().min(1),sha256:z.string()}).parse(await read(path+'.synthesis.json'));
 sourceTexts.push(synthesis.text);
 if(synthesis.sha256!==sha256)throw new Error('Voice WAV does not match its synthesis evidence: '+name);
 const raw=await read(path+'.small.transcript.json') as Transcript;
 const human=await reviewedPrimaryTranscript(path,synthesis.text),primary=human?.primary??raw;
 const alternatives:Transcript[]=human?[raw]:[];
 try{alternatives.push(await read(path+'.base.transcript.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 let diagnostic:Transcript|undefined;
 try{const actual=await read(join('data/research',runId,'voice-diagnostic-small-en-beam5.json'));if(actual.sourceWavSha256===sha256){diagnostic=actual;alternatives.push(actual);}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const terms=extractCriticalTerms(synthesis.text,[...script.criticalTerms,...(editorial?.criticalTerms??[])]);
 const review=evaluateVoice(synthesis.text,primary,terms,policy,alternatives);
 await json(join(output,name+'.corrected-review.json'),{sourceWavSha256:sha256,report:review,approval:false,humanTranscriptReview:human?{evidenceFile:basename(human.evidencePath),rawTranscriptPreserved:true}:null,note:human?'Exact hash-bound owner-confirmed ASR word is explicit in separate evidence. All other lexical differences remain. This export grants no new approval.':'Exact citation-number formatting only. Lexical differences remain. Raw ASR and original acoustic QA are preserved separately.'});
 await copyFile(path,join(output,name));
 for(const suffix of ['.small.transcript.json','.base.transcript.json','.synthesis.json','.metrics.json','.voice-QA.json','.diff.json','.normalized-comparison.json','.human-reviewed.transcript.json','.human-review-application.json','.pre-human-review.voice-QA.json','.pre-human-review.normalized-comparison.json','.pre-human-review.diff.json']){
  try{await copyFile(path+suffix,join(output,name+suffix));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 }
 if(diagnostic)await json(join(output,name+'.beam5-diagnostic.json'),diagnostic);
 parts.push({name,sha256,durationSeconds:await duration(path),humanReviewApplied:!!human,status:review.status,wordErrorRate:review.wordErrorRate,criticalTermAccuracy:review.criticalTermAccuracy,failedCriticalTerms:review.criticalChecks.filter(c=>!c.passed)});
}
if(!parts.length)throw new Error('No actual raw narration WAVs in checkpoint');
const focus=z.coerce.number().int().positive().parse(process.env.FOCUS_PART??'2');
const focusName='narration-chapter-'+focus+'.wav',part=parts.find(p=>p.name===focusName);
if(!part)throw new Error('Requested narration part is missing');
const start=z.coerce.number().nonnegative().parse(process.env.CLIP_START??'132.5');
const end=z.coerce.number().positive().parse(process.env.CLIP_END??'138.5');
if(end<=start||end>part.durationSeconds||end-start>30)throw new Error('Invalid listening excerpt bounds');
const stem='voice-evidence-'+runId+'-'+execution;
const excerpt=join(output,stem+'-excerpt.mp3');
await exec('ffmpeg',['-y','-v','error','-ss',String(start),'-i',join(assets,focusName),'-t',String(end-start),'-ac','1','-ar','24000','-b:a','64k',excerpt],{timeout:30000});
for(const name of ['script.json','facts.json','script-quality.json'])await copyFile(join(root,name),join(output,name));
const spoken=sourceTexts.join(' '),fullScript=script.scenes.map(s=>s.narration).join(' ');
const coverage={complete:spoken===fullScript,prefixMatches:fullScript.startsWith(spoken),generatedScriptWords:spoken.split(' ').filter(Boolean).length,totalScriptWords:fullScript.split(' ').filter(Boolean).length};
const summary={narrationCoverage:coverage,kind:'voice-evidence-review-only',runId,sourceRunId:process.env.SOURCE_RUN_ID??null,execution,videoApproved:false,narratorChanged:false,videoGenerated:false,factsPassed:facts.passed,checkedClaims:facts.checkedClaims,voiceStatus:parts.some(p=>p.status==='fail')?'blocked-critical-review':parts.some(p=>p.status==='review')?'needs-listening-review':'lexical-gates-pass-only',parts,excerpt:{file:basename(excerpt),source:focusName,startSeconds:start,endSeconds:end,note:'Listening cut bounds, not synthetic word timestamps'},paidApiCalls:0};
await json(join(output,'review-summary.json'),summary);
await writeFile(join(output,'README.txt'),['VOICE EVIDENCE ONLY. This export does not approve narration or a video.','Raw WAVs are unchanged; synthesis SHA256 is verified.','Original raw ASR/QA and corrected comparisons are separate.','Scripture citation formatting is normalized only when the same book and exact number sequence occur in the reference.','Only exact hash-bound ASR words explicitly confirmed by the owner may have a separate reviewed transcript; original ASR is preserved. Every other critical discrepancy still blocks production.','The excerpt is a listening aid; original measured Whisper timestamps are preserved.','No TTS regeneration, image generation, paid API or YouTube publication occurred in this export.'].join(String.fromCharCode(10)));
const manifest=[];
for(const name of (await readdir(output)).sort())manifest.push({name,sha256:await fileDigest(join(output,name))});
await json(join(output,'evidence-manifest.json'),{runId,execution,files:manifest});
const archive=resolve(output,'..',stem+'.zip');
await exec('python3',['-c','import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED,compresslevel=4); [z.write(p,p.name) for p in sorted(root.iterdir()) if p.is_file()]; z.close()',output,archive],{timeout:60000});
await copyFile(join(output,'review-summary.json'),resolve(output,'..',stem+'-summary.json'));
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,['archive='+archive,'excerpt='+excerpt,'summary='+resolve(output,'..',stem+'-summary.json'),'voice_status='+summary.voiceStatus,''].join(String.fromCharCode(10)));
console.log(JSON.stringify({event:'voice_evidence_exported',archive,voiceStatus:summary.voiceStatus,parts:parts.map(p=>({name:p.name,wordErrorRate:p.wordErrorRate,failedCriticalTerms:p.failedCriticalTerms}))}));
