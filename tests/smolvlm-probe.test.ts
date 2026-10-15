import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseProbeAnswer,probeOutcome} from '../scripts/smolvlm-probe';
test('CPU visual probe preserves abstentions and never turns an absent answer into acceptance',()=>{
 assert.equal(parseProbeAnswer('YES. A collar is visible.','boolean'),true);
 assert.equal(parseProbeAnswer('No. Only a plain tunic.','boolean'),false);
 for(const text of ['uncertain','yesterday','{"answer":true}','I cannot see it'])assert.equal(parseProbeAnswer(text,'boolean'),null);
 assert.equal(probeOutcome(null,false),'abstained');assert.equal(probeOutcome(false,true),'incorrect');assert.equal(probeOutcome(true,true),'correct');
});
test('wing count parsing does not silently confuse a pair with a wing',()=>{
 assert.equal(parseProbeAnswer('2 wings are visible.','count'),2);
 assert.equal(parseProbeAnswer('two wings','count'),2);
 assert.equal(parseProbeAnswer('6','count'),6);
 assert.equal(parseProbeAnswer('2 pairs of wings','count'),null);
 assert.equal(parseProbeAnswer('two pairs','count'),null);
 assert.equal(parseProbeAnswer('probably several','count'),null);
 assert.equal(probeOutcome(2,6),'incorrect');
});
