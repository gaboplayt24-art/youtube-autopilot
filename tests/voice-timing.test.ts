import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settleWordOverlaps} from '../src/voice/chapters';
test('small ASR boundary overlaps meet at their midpoint; large ones and the raw input are left alone',()=>{
 const raw=[{text:'a',start:20.66,end:20.86},{text:'gourd',start:20.8,end:21.16},{text:'grew',start:21.2,end:21.5},{text:'up',start:21.2,end:21.6}];
 const {words,settled}=settleWordOverlaps(raw);
 assert.deepEqual(settled,[1]);assert.equal(words[0].end,20.83);assert.equal(words[1].start,20.83);
 assert.equal(words[3].start,21.2,'a 300 ms overlap is not hidden');assert.equal(raw[0].end,20.86,'the measured transcript is not mutated');
});
