import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterLines,seoDescription,seoTags,HASHTAGS} from '../src/packaging/seo';

const scenes=[{id:'chapter-1',from:0,frames:900},{id:'chapter-2',from:900,frames:3600},{id:'chapter-3',from:4500,frames:3600},{id:'chapter-4',from:8100,frames:9000}];
test('chapters start at 0:00 from measured scene frames and use the run chapter titles',()=>{
 assert.deepEqual(chapterLines(scenes,30,{'chapter-2':'Flight to Tarshish'}),['0:00 The question','0:30 Flight to Tarshish','4:30 The answer']);
 assert.deepEqual(chapterLines(scenes.slice(0,2),30,{}),[],'fewer than three chapters show none');
 assert.deepEqual(chapterLines([...scenes,{id:'x',from:17100,frames:200}],30,{}),[],'a chapter under 10 s disables them all');
});
test('the description keeps its sources, gains chapters after the opening paragraph and ends with hashtags once',()=>{
 const d='Hook line.\n\nSummary.\n\nSources:\nhttps://example.org/a';
 const out=seoDescription(d,['0:00 The question','0:30 Part 1','1:00 The answer']);
 assert.ok(out.startsWith('Hook line.\n\nChapters:\n0:00 The question'));assert.ok(out.includes('https://example.org/a'));
 assert.ok(out.endsWith(HASHTAGS));assert.equal(seoDescription(out,[]).split(HASHTAGS).length,2);
});
test('tags put topic phrases first, dedupe, and stay within YouTube limits',()=>{
 const tags=seoTags(['What did Noah\'s ark look like','Bible History',...Array.from({length:40},(_,i)=>'phrase number '+i)]);
 assert.equal(tags[0],"what did noah's ark look like");assert.equal(tags.filter(t=>t==='bible history').length,1);
 assert.ok(tags.length<=30&&tags.reduce((n,t)=>n+t.length+(t.includes(' ')?2:0)+1,0)<=480);
});
