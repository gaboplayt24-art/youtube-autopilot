import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import approved from '../data/benchmarks/initial-packaging/approved-packaging-plan.json';
import {recoverPackagingCandidate} from '../src/packaging/v2';
test('a revised source brief cannot recover an old same-topic packaging response',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'packaging-context-'));
 try{
  const candidate={...approved,concepts:approved.concepts.map(c=>({...c,subjectCount:1,narrativeNeedForMultipleSubjects:false,topicAlignment:'An earlier topic-specific direction',historicalResearchRequired:true}))};
  await mkdir(join(dir,'gemini-responses'));
  const raw=JSON.stringify({finishReason:'STOP',model:'fixture',text:JSON.stringify(candidate)});
  const path=join(dir,'gemini-responses','earlier.json');await writeFile(path,raw);
  assert.ok(await recoverPackagingCandidate(dir,candidate.topic));
  assert.equal(await recoverPackagingCandidate(dir,candidate.topic,{instruction:'A revised source-grounded title brief'}),null);
  assert.equal(await readFile(path,'utf8'),raw);
 }finally{await rm(dir,{recursive:true});}
});
