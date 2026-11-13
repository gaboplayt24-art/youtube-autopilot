import test from 'node:test';
import assert from 'node:assert/strict';
import {shortHookTitles,shortTitlesPrompt} from '../src/social/short-titles';

test('hook titles cover the chapters after the hook and drop invalid or unknown ones', async () => {
 const scenes=['hook','c1','c2','c3'].map(id=>({id,narration:`Narration of ${id} about the Nephilim in Genesis six.`}));
 let prompt='';
 const llm={json:async(p:string)=>{prompt=p;return {titles:[{sceneId:'c1',title:'Who Were the Giants of Genesis 6? #Shorts'},{sceneId:'c2',title:'Short'},{sceneId:'zz',title:'An unknown chapter title here'}]};}} as never;
 const r=await shortHookTitles(llm,'Who were the Nephilim?',scenes);
 assert.deepEqual(r.titles,[{sceneId:'c1',title:'Who Were the Giants of Genesis 6?'}]);
 assert.ok(!prompt.includes('"hook"')&&prompt.includes('"c3"'));
});

test('the prompt keeps the channel rules', () => {
 const p=shortTitlesPrompt('X',[{sceneId:'c1',opening:'text'}]);
 assert.match(p,/never copy another channel/);assert.match(p,/proven or debunked/);
});
