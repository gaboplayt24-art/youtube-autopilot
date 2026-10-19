import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planClip,releaseSlots,chapterClipCandidates,chapterClipSelection} from '../src/social/plan';
import type {Composition} from '../src/orchestration/schemas';
const words=Array.from({length:20},(_,i)=>({text:'word'+i,start:100+i,end:100+i+.8}));
const composition={cues:[{sceneId:'s',start:100,end:120,text:words.map(w=>w.text).join(' '),words}],shots:Array.from({length:4},(_,i)=>({id:'shot'+i,start:100+i*5,end:105+i*5}))} as Composition;
const candidate={id:'A',title:'A real passage',source:'Reference',narration:words.map(w=>w.text).join(' ')};
test('vertical cut uses final composition timestamps, keeps complete words and covers every shot',()=>{
 const plan=planClip(candidate,composition);assert.equal(plan.start,100);assert.equal(plan.end,119.8);assert.equal(plan.cues[0].words![0].start,0);assert.equal(plan.cues.at(-1)!.end,plan.duration);assert.equal(plan.shots.at(-1)!.end,plan.duration);assert.equal(plan.cues.flatMap(c=>c.words!).length,20);
});
test('missing, ambiguous narration and visual gaps block export instead of inventing timestamps',()=>{
 assert.throws(()=>planClip({...candidate,narration:candidate.narration+' invented'},composition),/unique/);
 assert.throws(()=>planClip(candidate,{...composition,cues:[...composition.cues,...composition.cues]}),/unique/);
 assert.throws(()=>planClip(candidate,{...composition,shots:composition.shots.slice(1)}),/coverage/);
});
test('clips follow the actual main release over three days and never use an expired processing window',()=>{
 const slots=releaseSlots('2026-10-16T17:00:00Z',new Date('2026-10-16T12:00:00Z'));assert.equal(slots[0].youtube,'2026-10-16T18:00:00.000Z');assert.equal(slots[2].tiktok,'2026-10-18T18:30:00.000Z');assert.throws(()=>releaseSlots('2026-10-15T17:00:00Z',new Date('2026-10-16T12:00:00Z')),/three hours/);
});

test('chapter candidates use complete measured sentences and keep the existing clip gates',()=>{
 const cues=['c1','c2','c3'].map((sceneId,index)=>{
  const start=index*40,words=Array.from({length:24},(_,i)=>({text:sceneId+'word'+i+((i+1)%6===0?'.':''),start:start+i*1.2,end:start+i*1.2+1}));
  return {sceneId,start,end:start+28.6,text:words.map(w=>w.text).join(' '),words};
 });
 const full={cues,shots:cues.flatMap(c=>Array.from({length:8},(_,i)=>({id:c.sceneId+'s'+i,start:c.start+i*4,end:c.start+(i+1)*4})))} as Composition;
 const selection=chapterClipSelection.parse({runId:'episode',chapters:cues.map((c,i)=>({id:'ABC'[i],sceneId:c.sceneId,title:'A complete chapter passage',source:'Test source'}))});
 const candidates=chapterClipCandidates(selection,full);
 assert.equal(candidates.length,3);
 candidates.forEach((c,i)=>{
  assert.equal(c.narration,cues[i].text);
  const plan=planClip(c,full);assert.equal(plan.start,cues[i].words[0].start);assert.equal(plan.end,cues[i].words.at(-1)!.end);
 });
 assert.throws(()=>chapterClipCandidates(selection,{...full,cues:cues.map(c=>({...c,words:c.words.map(w=>({...w,text:w.text.replaceAll('.','')}))}))}),/No complete measured/);
 assert.throws(()=>chapterClipCandidates(selection,{...full,cues:[]}),/Measured chapter words missing/);
 assert.throws(()=>chapterClipCandidates(selection,{...full,cues:[...cues,...cues]}),/unique/);
 assert.throws(()=>chapterClipSelection.parse({...selection,chapters:[selection.chapters[0],selection.chapters[0],selection.chapters[2]]}),/distinct/);
});
