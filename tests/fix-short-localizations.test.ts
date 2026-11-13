import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseShort} from '../scripts/fix-short-localizations';
test('Short metadata is parsed from the generated format only',()=>{
 const p=parseShort({title:'Why did Jonah run away? #Shorts',description:'An illustrated excerpt about biblical depictions of angels.\nText reference: Jonah 1:3\nFull illustrated episode: https://www.youtube.com/watch?v=AbCdEfGhIjK\n\nOptional support: x'});
 assert.deepEqual(p,{title:'Why did Jonah run away?',source:'Jonah 1:3',main:'AbCdEfGhIjK'});
 assert.throws(()=>parseShort({title:'x',description:'hand written'}),/refusing/);
});
