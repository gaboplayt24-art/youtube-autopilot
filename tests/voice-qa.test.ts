import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareTranscripts,evaluateVoice,measuredReferenceAlignment,normalizedTokens,requireVoiceQA,extractCriticalTerms} from '../src/voice/qa';
const policy={passWer:.02,reviewWer:.05,maxSkippedPhraseWords:3,maxUnexpectedPauseSeconds:2.5,maxPauseSeconds:8,discontinuityThreshold:.45,benchmarkMinSeconds:60,benchmarkMaxSeconds:90,qwenMaxProbeSeconds:300,qwenMaxRealTimeFactor:8,qwenMaxPeakMemoryMb:5500};
test('indefinite numeric articles preserve the complete quantity and protect it as a critical value',()=>{
 assert.deepEqual(normalizedTokens('a hundred and fifty').map(t=>t.text),['150']);
 assert.deepEqual(normalizedTokens('an hundred and fifty').map(t=>t.text),['150']);
 assert.deepEqual(normalizedTokens('a thousand').map(t=>t.text),['1000']);
 assert.equal(compareTranscripts('a hundred and fifty days','150 days').wordErrorRate,0);
 assert.ok(compareTranscripts('a boat','one boat').wordErrorRate>0);
 const script='Noah waited a hundred and fifty days. '+Array(30).fill('The drawing is interpretive.').join(' ');const terms=extractCriticalTerms(script);assert.ok(terms.includes('150'));assert.ok(!terms.includes('50'));
 const text=script.replace('a hundred and fifty','fifty');const report=evaluateVoice(script,{text,chunks:[{text,timestamp:[0,50]}]},terms,policy);assert.equal(report.status,'fail');assert.ok(report.criticalChecks.some(c=>c.term==='150'&&!c.passed));
});
test('normalization accepts punctuation, case and common number spelling without making lexical errors disappear',()=>{assert.deepEqual(normalizedTokens('On 30 BCE, August 27, 1997.' ).map(x=>x.text),['on','30','bce','august','27','1997']);assert.equal(compareTranscripts('Augustus arrived in 27 BCE','Augustus arrived in twenty seven B.C.E.').wordErrorRate,0);assert.ok(compareTranscripts('sealed the letter','seal the letter').wordErrorRate>0)});
test('low WER passes while critical term mutation fails',()=>{const good=evaluateVoice('Augustus arrived in Alexandria on 27 BCE',{text:'Augustus arrived in Alexandria on twenty seven B.C.E.',chunks:[{text:'Augustus arrived in Alexandria on twenty seven B.C.E.',timestamp:[0,4]}]},['Augustus','Alexandria','27 BCE'],policy);assert.equal(good.status,'pass');const bad=evaluateVoice('Augustus arrived in Alexandria on 27 BCE',{text:'August arrived in Alexandria on 27 BCE',chunks:[{text:'August arrived in Alexandria on 27 BCE',timestamp:[0,4]}]},['Augustus','Alexandria','27 BCE'],policy);assert.equal(bad.status,'fail');assert.equal(bad.criticalTermAccuracy,2/3)});
test('repeated words and independent ASR alternatives are classified without disabling QA',()=>{const report=evaluateVoice('The washed cloth was sealed',{text:'The washedwashed cloth was seal',chunks:[{text:'The washedwashed cloth was seal',timestamp:[0,3]}]},[],policy,[{text:'The washed cloth was sealed',chunks:[{text:'The washed cloth was sealed',timestamp:[0,3]}]}]);assert.ok(report.defects.some(d=>d.kind.includes('repeated')));assert.ok(report.classifications.some(d=>d.classification==='likelyASRError'));assert.ok(['fail','review'].includes(report.status))});
test('WER review preserves evidence and requires explicit listening approval',()=>{const report=evaluateVoice('washed cloth was sealed in the quiet room while the careful clerk checked every mark and closed the wooden box',{text:'washed cloth was seal in the quiet room while the careful clerk checked every mark and closed the wooden box',chunks:[{text:'washed cloth was seal in the quiet room while the careful clerk checked every mark and closed the wooden box',timestamp:[0,3]}]},[],policy);assert.equal(report.status,'review');assert.throws(()=>requireVoiceQA(report),/Voice QA REVIEW/);assert.equal(report.normalizedComparison.differences[0].reference,'sealed');});
test('measured alignment retains whole ASR spans and never fabricates missing word timestamps',()=>{const alignment=measuredReferenceAlignment('a stone wall',{text:'a stonewall',chunks:[{text:'a',timestamp:[0,1]},{text:'stonewall',timestamp:[1,3]}]});assert.deepEqual(alignment,[{text:'a',start:0,end:1},{text:'stone wall',start:1,end:3}]);assert.throws(()=>measuredReferenceAlignment('a wall',{text:'a',chunks:[{text:'a',timestamp:[0,null]}]}),/missing timestamp/)});
test('milestone approval permits REVIEW but never a missing critical name',()=>{const review=evaluateVoice('washed cloth was sealed in the quiet room while the careful clerk checked every mark and closed the wooden box',{text:'washed cloth was seal in the quiet room while the careful clerk checked every mark and closed the wooden box',chunks:[{text:'washed cloth was seal in the quiet room while the careful clerk checked every mark and closed the wooden box',timestamp:[0,3]}]},[],policy);assert.doesNotThrow(()=>requireVoiceQA(review,true));const critical=evaluateVoice('Augustus arrived in Alexandria',{text:'August arrived in Alexandria',chunks:[{text:'August arrived in Alexandria',timestamp:[0,3]}]},['Augustus'],policy);assert.throws(()=>requireVoiceQA(critical,true),/FAIL/);});

test('ASR dotted scripture citations match only exact reference numbers and preserve original timestamp indices',()=>{
 const reference='Check Isaiah 6:2 and Ezekiel 1:4-21, Genesis 19:1-3 and Hebrews 13:2.';
 const observed='Check Isaiah 6.2 and Ezekiel 1.4.21, Genesis 19.1.3 and Hebrews 13.2.';
 const c=compareTranscripts(reference,observed);assert.equal(c.wordErrorRate,0);assert.deepEqual(c.observedTokens.filter(t=>t.indices[0]===2).map(t=>t.text),['6','2']);
 assert.ok(compareTranscripts('Check Isaiah 6:2','Check Isaiah 6.3').wordErrorRate>0);
 assert.ok(compareTranscripts('A value of 6.2','A value of 6 2').wordErrorRate>0);
 assert.ok(compareTranscripts('Check Isaiah 6:2 and a value of 6.2','Check Isaiah 6.2 and a value of 6 2').wordErrorRate>0);
 const aligned=measuredReferenceAlignment('Isaiah 6:2',{text:'Isaiah 6.2',chunks:[{text:'Isaiah',timestamp:[0,1]},{text:'6.2',timestamp:[1,2]}]});
 assert.deepEqual(aligned,[{text:'Isaiah',start:0,end:1},{text:'6:2',start:1,end:2}]);
});

test('a changed lower-case factual term fails even when lexical WER is below two percent',()=>{
 const context=Array.from({length:250},(_,i)=>'detail'+i).join(' ');
 const report=evaluateVoice(context+' seraphim',{text:context+' set of time',chunks:[{text:context+' set of time',timestamp:[0,90]}]},['seraphim'],policy);
 assert.equal(report.lexicalStatus,'pass');assert.equal(report.status,'fail');assert.equal(report.criticalTermAccuracy,0);
});
test('sentence-initial personal pronouns are not inferred historical names; WER and factual gates remain strict',()=>{
 const script='Our timeline follows Genesis. Augustus lived in Rome for forty years. '+Array(30).fill('The illustration is explanatory.').join(' ');
 const terms=extractCriticalTerms(script,['Augustus','Rome','Genesis']);assert.ok(!terms.includes('Our'));for(const name of ['Augustus','Rome','Genesis','40'])assert.ok(terms.includes(name));
 const transcript=(text:string)=>({text,chunks:[{text,timestamp:[0,50] as [number,number]}]});
 const ordinary=evaluateVoice(script,transcript(script.replace('Our','A')),terms,policy);assert.equal(ordinary.status,'pass');assert.equal(ordinary.substitutions,1);assert.ok(ordinary.wordErrorRate>0);
 const changed=evaluateVoice(script,transcript(script.replace('Augustus','August')),terms,policy);assert.equal(changed.status,'fail');assert.ok(changed.criticalChecks.some(t=>t.term==='Augustus'&&!t.passed));
 const number=evaluateVoice(script,transcript(script.replace('forty','fourteen')),terms,policy);assert.equal(number.status,'fail');assert.ok(number.criticalChecks.some(t=>t.term==='40'&&!t.passed));
 for(const pronoun of ['Our','Your','Their','His','Her','My','You','We'])assert.ok(!extractCriticalTerms(pronoun+' illustration is interpretive.').includes(pronoun));
});
