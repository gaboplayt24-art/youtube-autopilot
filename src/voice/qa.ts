import {z} from 'zod';
import {exec,read,json,duration} from '../orchestration/io';
import type {Alignment} from '../providers/interfaces';

export const voiceQAPolicy=z.object({passWer:z.number().min(0).max(1),reviewWer:z.number().min(0).max(1),maxSkippedPhraseWords:z.number().int().min(2),maxUnexpectedPauseSeconds:z.number().positive(),maxPauseSeconds:z.number().positive(),discontinuityThreshold:z.number().positive(),benchmarkMinSeconds:z.number().positive(),benchmarkMaxSeconds:z.number().positive(),qwenMaxProbeSeconds:z.number().positive(),qwenMaxRealTimeFactor:z.number().positive(),qwenMaxPeakMemoryMb:z.number().positive()}).refine(p=>p.passWer<p.reviewWer&&p.maxUnexpectedPauseSeconds<p.maxPauseSeconds&&p.benchmarkMinSeconds<p.benchmarkMaxSeconds,'Invalid voice QA thresholds');
export type VoiceQAPolicy=z.infer<typeof voiceQAPolicy>;
export const loadVoiceQAPolicy=async()=>voiceQAPolicy.parse(await read('config/voice-qa.json'));
export type Transcript={text:string;model?:string;chunks:{text:string;timestamp:[number,number|null]}[]};
export type Token={text:string;indices:number[]};
const ordinals:Record<string,string>={first:'1st',second:'2nd',third:'3rd',fourth:'4th',fifth:'5th',sixth:'6th',seventh:'7th',eighth:'8th',ninth:'9th',tenth:'10th',eleventh:'11th',twelfth:'12th',thirteenth:'13th',fourteenth:'14th',fifteenth:'15th',sixteenth:'16th',seventeenth:'17th',eighteenth:'18th',nineteenth:'19th',twentieth:'20th'};
const numberWords:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function integerWords(words:string[]){let total=0,group=0;for(const w of words){if(w==='and')continue;if(w==='hundred')group=(group||1)*100;else if(w==='thousand'){total+=(group||1)*1000;group=0;}else group+=numberWords[w];}return total+group;}
/** Only orthography and numeric representations change. Lexical errors remain errors. */
export function normalizedTokens(text:string):Token[]{
 const raw=text.trim().split(/\s+/);const pieces:Token[]=[];
 raw.forEach((word,i)=>{const value=word.toLowerCase().replace(/(\d),(?=\d{3}\b)/g,'$1').replace(/(?<=[a-z])\.(?=[a-z])/g,'').replace(/[’']/g,'');for(const part of value.match(/[a-z]+|\d+(?:\.\d+)?(?:st|nd|rd|th)?/g)??[])pieces.push({text:ordinals[part]??(part==='bc'?'bce':part==='ad'?'ce':part),indices:[i]});});
 const result:Token[]=[];
 for(let i=0;i<pieces.length;i++){
  const first=pieces[i];if(numberWords[first.text]===undefined){result.push(first);continue;}
  const group=[first];const take=()=>group.push(pieces[++i]);
  // Read one grammatical number, not arbitrary adjacent number words ("one two").
  const tens=()=>{if(numberWords[group.at(-1)!.text]>=20&&numberWords[pieces[i+1]?.text]>0&&numberWords[pieces[i+1]?.text]<10)take();};
  tens();
  if(pieces[i+1]?.text==='hundred'){take();if(pieces[i+1]?.text==='and'&&numberWords[pieces[i+2]?.text]!==undefined)take();if(numberWords[pieces[i+1]?.text]!==undefined){take();tens();}}
  if(pieces[i+1]?.text==='thousand'){take();if(pieces[i+1]?.text==='and'&&numberWords[pieces[i+2]?.text]!==undefined)take();if(numberWords[pieces[i+1]?.text]!==undefined){take();if(pieces[i+1]?.text==='hundred'){take();if(pieces[i+1]?.text==='and')take();if(numberWords[pieces[i+1]?.text]!==undefined)take();}tens();}}
  let n=integerWords(group.map(t=>t.text));
  // Conventional spoken years: nineteen ninety seven / twenty twenty four.
  if(group.length===1&&[18,19,20].includes(n)&&numberWords[pieces[i+1]?.text]>=20){const century=n;take();tens();n=century*100+integerWords(group.slice(1).map(t=>t.text));}
  result.push({text:String(n),indices:[...new Set(group.flatMap(t=>t.indices))]});
 }
 return result;
}
export type Edit={type:'equal'|'substitution'|'insertion'|'deletion';referenceIndex:number|null;observedIndex:number|null;reference:string|null;observed:string|null};
export function compareTranscripts(reference:string,observed:string){
 const a=normalizedTokens(reference),b=normalizedTokens(observed),cols=b.length+1;const matrix=new Uint32Array((a.length+1)*cols);
 for(let i=0;i<=a.length;i++)matrix[i*cols]=i;for(let j=0;j<=b.length;j++)matrix[j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)matrix[i*cols+j]=Math.min(matrix[(i-1)*cols+j]+1,matrix[i*cols+j-1]+1,matrix[(i-1)*cols+j-1]+Number(a[i-1].text!==b[j-1].text));
 const edits:Edit[]=[];let i=a.length,j=b.length;
 while(i||j){if(i&&j&&matrix[i*cols+j]===matrix[(i-1)*cols+j-1]+Number(a[i-1].text!==b[j-1].text)){edits.push({type:a[i-1].text===b[j-1].text?'equal':'substitution',referenceIndex:i-1,observedIndex:j-1,reference:a[--i].text,observed:b[--j].text});}else if(j&&matrix[i*cols+j]===matrix[i*cols+j-1]+1){edits.push({type:'insertion',referenceIndex:null,observedIndex:j-1,reference:null,observed:b[--j].text});}else {edits.push({type:'deletion',referenceIndex:i-1,observedIndex:null,reference:a[--i].text,observed:null});}}
 edits.reverse();const count=(type:Edit['type'])=>edits.filter(e=>e.type===type).length;const substitutions=count('substitution'),insertions=count('insertion'),deletions=count('deletion');
 return {referenceTokens:a,observedTokens:b,wordErrorRate:a.length?(substitutions+insertions+deletions)/a.length:1,substitutions,insertions,deletions,edits,differences:edits.filter(e=>e.type!=='equal')};
}
const generic=new Set('Before After The This These Those A An In On At By For From To As And But We They He She It There Every Somewhere Beyond Somewhere Salt Deep Thick Loud Dark Smooth High Cool Wet Another Shouts Every Imagine Tonight Messages Follow Pause Now One Turn Put Choose Write What How When Why'.toLowerCase().split(' '));
export function extractCriticalTerms(text:string,declared:string[]=[]){const names=(text.match(/\b[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[IVX]+))*/g)??[]).filter(t=>!generic.has(t.toLowerCase()));const numbers=normalizedTokens(text).filter(t=>/^\d/.test(t.text)).map(t=>t.text);// A capitalized single word that the text also uses in lowercase ("Scholars" opening a sentence, "most scholars" later) is a common word, not a name.
 const common=(term:string)=>/^[A-Z][a-z]+$/.test(term)&&new RegExp(`(^|[^A-Za-z])${term.toLowerCase()}([^A-Za-z]|$)`).test(text);
 return [...new Set([...declared,...names,...numbers])].filter(term=>!common(term)).filter(term=>{const words=normalizedTokens(term).map(t=>t.text),all=normalizedTokens(text).map(t=>t.text);return all.some((_,i)=>words.every((w,j)=>all[i+j]===w));});}
export function evaluateVoice(script:string,transcript:Transcript,criticalTerms:string[],policy:VoiceQAPolicy,alternatives:Transcript[]=[]){
 const comparison=compareTranscripts(script,transcript.text);const lexicalStatus=comparison.wordErrorRate<=policy.passWer?'pass':comparison.wordErrorRate<=policy.reviewWer?'review':'fail';
 const criticalChecks=criticalTerms.flatMap(term=>{const words=normalizedTokens(term).map(t=>t.text);return comparison.referenceTokens.flatMap((_,start)=>words.every((w,j)=>comparison.referenceTokens[start+j]?.text===w)?[{term,referenceStart:start,passed:words.every((_,j)=>comparison.edits.some(e=>e.referenceIndex===start+j&&e.type==='equal')),observed:comparison.edits.filter(e=>e.referenceIndex!==null&&e.referenceIndex>=start&&e.referenceIndex<start+words.length).map(e=>e.observed).filter(Boolean).join(' ')}]:[]);});
 const other=alternatives.map(t=>compareTranscripts(script,t.text));
 const defects:{kind:string;classification:'likelyASRError'|'likelyTTSError'|'uncertain';severity:'info'|'review'|'fail';evidence:string}[]=[];
 for(const edit of comparison.differences){const index=edit.referenceIndex;const supported=index!==null&&other.some(c=>c.edits.some(e=>e.referenceIndex===index&&e.type==='equal'));const repeated=edit.observed!==null&&(/^(.{2,})\1+$/.test(edit.observed)||edit.type==='insertion'&&comparison.observedTokens[(edit.observedIndex??0)-1]?.text===edit.observed);
  if(repeated)defects.push({kind:'repeated word or syllable',classification:supported?'likelyASRError':'uncertain',severity:supported?'info':'review',evidence:JSON.stringify(edit)});
 }
 let run:Edit[]=[];const inspectRun=()=>{if(run.length<policy.maxSkippedPhraseWords){run=[];return;}const confirmed=other.length>0&&other.every(c=>run.every(d=>c.edits.some(e=>e.referenceIndex===d.referenceIndex&&e.type==='deletion')));defects.push({kind:run.at(-1)?.referenceIndex===comparison.referenceTokens.length-1?'truncated sentence':'skipped phrase',classification:confirmed?'likelyTTSError':'uncertain',severity:confirmed?'fail':'review',evidence:run.map(e=>e.reference).join(' ')});run=[];};for(const edit of comparison.edits){if(edit.type==='deletion')run.push(edit);else inspectRun();}inspectRun();
 const validTimestamps=transcript.chunks.filter(c=>normalizedTokens(c.text).length).every(c=>c.timestamp[1]!==null&&c.timestamp[0]>=0&&c.timestamp[1]>c.timestamp[0]);
 const criticalTermAccuracy=criticalChecks.length?criticalChecks.filter(c=>c.passed).length/criticalChecks.length:1;
 const status=lexicalStatus==='fail'||criticalChecks.some(c=>!c.passed)||defects.some(d=>d.severity==='fail')?'fail':lexicalStatus==='review'||defects.some(d=>d.severity==='review')?'review':'pass';
 return {status,lexicalStatus,wordErrorRate:comparison.wordErrorRate,substitutions:comparison.substitutions,insertions:comparison.insertions,deletions:comparison.deletions,criticalTerms,criticalChecks,criticalTermAccuracy,defects,timestampStatus:validTimestamps?'pass':'review',normalizedComparison:comparison,classifications:comparison.differences.map(e=>({edit:e,classification:e.referenceIndex!==null&&other.some(c=>c.edits.some(d=>d.referenceIndex===e.referenceIndex&&d.type==='equal'))?'likelyASRError':'uncertain'})),limitations:'ASR discrepancies do not prove a TTS defect. Acoustic/prosody proxies and short benchmarks require human listening; no narrator is selected.'};
}
export type VoiceQA=ReturnType<typeof evaluateVoice>;
/** REVIEW preserves evidence and requires listening approval; it is never an automatic PASS. */
export function requireVoiceQA(report:VoiceQA,approvedReview=false){if(report.status==='fail'||report.status==='review'&&!approvedReview)throw new Error(`Voice QA ${report.status.toUpperCase()}: WER ${(report.wordErrorRate*100).toFixed(2)}%; critical accuracy ${(report.criticalTermAccuracy*100).toFixed(2)}%; failed critical terms ${JSON.stringify([...new Set(report.criticalChecks.filter(c=>!c.passed).map(c=>c.term))])}. Evidence preserved; manual review required.`);}
/** Reference captions use DP correspondences to WHOLE measured ASR spans, never synthetic word times. */
export function measuredReferenceAlignment(script:string,transcript:Transcript):Alignment{
 const c=compareTranscripts(script,transcript.chunks.map(t=>t.text.trim()).join(' '));const words=script.trim().split(/\s+/);const spoken=transcript.chunks.flatMap((chunk,index)=>chunk.text.trim().split(/\s+/).filter(Boolean).map(()=>index));
 const groups:{from:number;to:number;chunks:number[]}[]=[];let pending:number[]=[];
 for(const edit of c.edits){if(edit.referenceIndex===null)continue;const refs=c.referenceTokens[edit.referenceIndex].indices;const observed=edit.observedIndex===null?[]:c.observedTokens[edit.observedIndex].indices.map(i=>spoken[i]);if(!observed.length){pending.push(...refs);continue;}const group={from:Math.min(...pending,...refs),to:Math.max(...refs),chunks:[...new Set(observed)]};pending=[];const previous=groups.at(-1);if(previous&&(group.from<=previous.to||group.chunks.some(i=>previous.chunks.includes(i)))){previous.to=Math.max(previous.to,group.to);previous.chunks=[...new Set([...previous.chunks,...group.chunks])];}else groups.push(group);}
 if(pending.length){const last=groups.at(-1);if(!last)throw new Error('No measured narration intervals');last.to=Math.max(last.to,...pending);}
 const result:Alignment=[];let zeroText='';let zeroStart:number|null=null;for(const group of groups){const chunks=group.chunks.map(i=>transcript.chunks[i]);if(chunks.some(c=>c.timestamp[1]===null))throw new Error('Local transcription missing timestamp');const unit={text:words.slice(group.from,group.to+1).join(' '),start:Math.min(...chunks.map(c=>c.timestamp[0])),end:Math.max(...chunks.map(c=>c.timestamp[1]!))};if(unit.end===unit.start){zeroText+=(zeroText?' ':'')+unit.text;zeroStart=zeroStart===null?unit.start:Math.min(zeroStart,unit.start);continue;}if(zeroText){unit.text=zeroText+' '+unit.text;unit.start=Math.min(unit.start,zeroStart!);zeroText='';zeroStart=null;}if(unit.end<unit.start||unit.start<0)throw new Error('Invalid measured timestamps');result.push(unit);}
 if(zeroText){const prior=result.at(-1);if(!prior)throw new Error('Local transcription missing timestamp');prior.text+=' '+zeroText;}
 if(result.map(w=>w.text).join(' ')!==words.join(' '))throw new Error('Measured phrase mapping does not cover source text');return result;
}
export async function inspectSpeech(path:string,transcript:Transcript,policy:VoiceQAPolicy){
 const seconds=await duration(path);const {stdout}=await exec('ffmpeg',['-v','error','-i',path,'-ac','1','-ar','16000','-f','f32le','pipe:1'],{encoding:'buffer',timeout:120000,maxBuffer:256*1024*1024});const samples=new Float32Array(stdout.buffer.slice(stdout.byteOffset,stdout.byteOffset+stdout.byteLength));const silences:{start:number;end:number}[]=[];const discontinuities:number[]=[];const frames:{at:number;rms:number}[]=[];let silent:number|null=null;
 for(let at=0;at<samples.length;at+=320){let power=0;for(let j=at;j<Math.min(samples.length,at+320);j++){power+=samples[j]**2;if(j>0&&Math.abs(samples[j]-samples[j-1])>policy.discontinuityThreshold&&Math.abs(samples[Math.max(0,j-16)])<.01&&Math.abs(samples[Math.min(samples.length-1,j+16)])<.01)discontinuities.push(j/16000);}const rms=Math.sqrt(power/Math.min(320,samples.length-at));frames.push({at:at/16000,rms});if(rms<.005&&silent===null)silent=at/16000;if(rms>=.005&&silent!==null){if(at/16000-silent>=.35)silences.push({start:silent,end:at/16000});silent=null;}}
 if(silent!==null&&seconds-silent>=.35)silences.push({start:silent,end:seconds});
 const unexpectedPauses=silences.filter(s=>s.end-s.start>policy.maxUnexpectedPauseSeconds&&s.start>.3&&s.end<seconds-.3);const prosodyResetCandidates=[];for(let i=1;i<silences.length;i++){const pause=silences[i];const before=frames.filter(f=>f.at>=pause.start-.4&&f.at<pause.start),after=frames.filter(f=>f.at>=pause.end&&f.at<pause.end+.4);const energy=(f:typeof frames)=>f.reduce((n,v)=>n+v.rms,0)/Math.max(1,f.length);const ratio=energy(after)/Math.max(.001,energy(before));if(ratio>4||ratio<.25)prosodyResetCandidates.push({at:pause.end,energyRatio:ratio,classification:'uncertain',note:'Energy discontinuity across a pause; emphasis can be intentional. Human listening required.'});}
 return {duration:seconds,silences,unexpectedPauses,pauseQuality:unexpectedPauses.length?'review':'pass',speechContinuity:!discontinuities.length&&!unexpectedPauses.some(p=>p.end-p.start>policy.maxPauseSeconds),audioDiscontinuities:[...new Set(discontinuities.map(t=>Math.round(t*1000)/1000))],prosodyResetCandidates,wordTimestamps:transcript.chunks,limitations:'PCM silence/impulse measurements and energy proxies; not a perceptual prosody classifier.'};
}
export async function saveVoiceEvidence(path:string,script:string,transcript:Transcript,criticalTerms:string[],alternatives:Transcript[]=[]){const policy=await loadVoiceQAPolicy(),report=evaluateVoice(script,transcript,criticalTerms,policy,alternatives),acoustic=await inspectSpeech(path,transcript,policy);if(!acoustic.speechContinuity)report.status='fail';else if(acoustic.unexpectedPauses.length&&report.status==='pass')report.status='review';await json(path+'.voice-QA.json',{...report,acoustic});await json(path+'.normalized-comparison.json',report.normalizedComparison);await json(path+'.diff.json',{wordErrorRate:report.wordErrorRate,substitutions:report.substitutions,insertions:report.insertions,deletions:report.deletions,differences:report.normalizedComparison.differences,classifications:report.classifications});return {...report,acoustic};}
