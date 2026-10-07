import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {qualityResumeConfig,qualityResumeDecision,assertFreeQuotaReset} from '../src/orchestration/quality-quota-resume';
import {migrateVisualQAState,nextSourceRevision} from '../src/visuals/qa-resume';
import {json,read} from '../src/orchestration/io';
import visualStyle from '../config/style-lock-v3.json';
import {doodleStyleLock,requireFreshVisualRun} from '../src/visuals/visual-approval';
test('single approved short audition resumes only after reset, before expiry and without a newer quality run',()=>{
 const config=qualityResumeConfig.parse({enabled:true,runId:'quality-doodle-001',styleVersion:'educational-doodle-v3',createdAt:'2026-10-07T23:00:00.000Z',sourceRunId:'123',notBefore:'2026-10-08T00:10:00.000Z',expiresAt:'2026-10-09T00:00:00.000Z'});
 const approval=doodleStyleLock.parse({...visualStyle,visualSystemApproved:true,approvedAt:'2026-10-07T22:00:00.000Z'});
 assert.equal(qualityResumeDecision(config,new Date('2026-10-07T23:59:00Z'),undefined,approval),'waiting_quota_reset');assert.equal(qualityResumeDecision(config,new Date('2026-10-08T00:11:00Z'),123,approval),'ready');assert.equal(qualityResumeDecision(config,new Date('2026-10-08T00:11:00Z'),124,approval),'newer_quality_run_exists');assert.equal(qualityResumeDecision(config,new Date('2026-10-09T00:00:00Z'),undefined,approval),'expired');
 assert.equal(qualityResumeDecision({...config,styleVersion:'historical-illustration-v1'},new Date(config.notBefore),123,approval),'obsolete_visual_style');
 assert.equal(qualityResumeDecision(config,new Date(config.notBefore),123),'visual_approval_required');
 assert.equal(qualityResumeDecision({...config,createdAt:approval.approvedAt!},new Date(config.notBefore),123,approval),'visual_approval_required');
 assert.throws(()=>requireFreshVisualRun({styleVersion:'historical-illustration-v1',createdAt:config.createdAt!},approval),/Obsolete/);
 assert.throws(()=>qualityResumeConfig.parse({...config,runId:'long-pilot'}));assert.throws(()=>assertFreeQuotaReset({state:'paused_quota',resumeAfter:config.notBefore,paidFallback:true},new Date(config.notBefore)));assert.throws(()=>assertFreeQuotaReset({state:'paused_quota',resumeAfter:config.notBefore,paidFallback:false},new Date('2026-10-07T23:59:00Z')),/future/);
});
test('role-aware migration preserves valid supporting roles and available repairs without overwriting generations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'visual-qa-resume-'));try{const root=join(dir,'sources');const state={worker:{revision:1,direction:'Wrongly replace worker with merchant'},bad:{revision:1,direction:'Fix framing'},pending:{revision:1,direction:'Fix action'}};
  await mkdir(join(root,'worker','revision-1'),{recursive:true});await json(join(root,'worker','revision-1','source.json'),{raw:'preserved'});await json(join(root,'bad','revision-1','source.json'),{raw:'preserved'});await mkdir(join(root,'pending','revision-1'),{recursive:true});
  await json(join(dir,'shot-content-QA.json'),{reviews:[{sourceImageId:'worker',subjectMatches:true,actionMatches:true,framingMatches:true,identityMatches:null},{sourceImageId:'bad',subjectMatches:true,actionMatches:false,framingMatches:false,identityMatches:true}]});
  const migrated=await migrateVisualQAState(dir,root,state);assert.deepEqual(Object.keys(migrated),['bad']);assert.deepEqual(await read(join(root,'worker','revision-1','source.json')),{raw:'preserved'});assert.equal(await nextSourceRevision(root,'worker',0),2);assert.equal(await nextSourceRevision(root,'pending',0),2);assert.deepEqual(await migrateVisualQAState(dir,root,migrated),migrated);
 }finally{await rm(dir,{recursive:true,force:true});}
});
