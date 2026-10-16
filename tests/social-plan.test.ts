import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planClip,releaseSlots} from '../src/social/plan';
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
