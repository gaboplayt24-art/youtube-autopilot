import test from 'node:test';
import assert from 'node:assert/strict';
import {respell,verifiedPronunciations} from '../src/voice/chapters';

test('only verified respellings of failed terms apply, on word boundaries and longest first', () => {
 const dictionary=[{term:'Anak',replacement:'Ay-nack',verified:true},{term:'Anakim',replacement:'Ann-uh-kim',verified:true},{term:'Ahiman',replacement:'Uh-high-man',verified:false},{term:'Eshcol',replacement:'Esh-coal',verified:true}];
 const r=respell('The sons of Anak, the Anakim, and Ahiman near Eshcol.',['Anak','Ahiman'],dictionary);
 assert.equal(r.text,'The sons of Ay-nack, the Anakim, and Ahiman near Eshcol.');
 assert.deepEqual(r.changes.map(c=>c.term),['Anak']);
 assert.equal(respell('Nothing here.',['Anak'],dictionary).changes.length,0);
});

test('the owner pronunciation config parses and every respelling is verified', async () => {
 const terms=await verifiedPronunciations();
 assert.ok(terms.length>0);
 assert.ok(terms.every(t=>t.verified&&t.replacement&&t.replacement!==t.term));
});
