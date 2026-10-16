import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadEditorialDraft,editorialDraftSchema} from '../src/script';
test('long and short episodes load their own validated evidence; missing optional drafts alone allow fallback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'editorial-sources-'));
 try{
  assert.equal(await loadEditorialDraft('long-episode',false,dir),undefined);
  await assert.rejects(()=>loadEditorialDraft('short-episode',true,dir));
  await writeFile(join(dir,'long-episode-editorial-draft.json'),JSON.stringify({sourceUrls:['https://example.com/primary-evidence'],researchFocus:'Distinguish sources from later tradition',chapters:[{topic:'Distinct original chapter'}]}));
  const draft=await loadEditorialDraft('long-episode',false,dir);assert.deepEqual(draft?.sourceUrls,['https://example.com/primary-evidence']);assert.deepEqual(draft?.chapters,[{topic:'Distinct original chapter'}]);
  await writeFile(join(dir,'broken-editorial-draft.json'),JSON.stringify({sourceUrls:[]}));await assert.rejects(()=>loadEditorialDraft('broken',false,dir));
  await assert.rejects(()=>loadEditorialDraft('../other',false,dir));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('editorial critical terms include lower-case factual vocabulary and reject malformed lists',()=>{
 const data={sourceUrls:['https://example.com/source'],criticalTerms:['seraphim','cherubim']};
 assert.deepEqual(editorialDraftSchema.parse(data).criticalTerms,data.criticalTerms);
 assert.throws(()=>editorialDraftSchema.parse({...data,criticalTerms:'seraphim'}));
});
