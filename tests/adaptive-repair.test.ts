import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repairUntilReviewed} from '../src/visuals/adaptive-repair';
import {artworkIdea} from '../src/visuals/illustration-schema';
import {continuationIdentity} from '../src/orchestration/continuation';
const idea=artworkIdea.parse({id:'example',narration:'Both faces are coated.',historicalContext:'Illustrated biblical construction example.',concept:'Two close views show both sides of the coated wooden plank, with simple flat colours.',overlay:null,labelPlacement:'top',characterRoles:[]});
const rejected={source:{path:'rejected.png',sha256:'a'.repeat(64)},review:{passed:false,objectiveFailures:['requiredConcept'],issues:['Only one side visible']},artwork:undefined as unknown};
test('adaptive correction keeps generating only while actual objective review fails, with no fixed attempt count',async()=>{
 let plans=0,generations=0;
 const result=await repairUntilReviewed(rejected,async()=>({...idea,concept:idea.concept+' Correction '+(++plans)}),async()=>{generations++;return generations<4?rejected:{...rejected,review:{passed:true,objectiveFailures:[],issues:[]},artwork:{referenceQAPassed:true}};});
 assert.equal(generations,4);assert.equal(result.review.passed,true);assert.ok(result.artwork);
});
test('accepted artwork does not regenerate, repeated failed concepts stop, provider quota errors propagate',async()=>{
 const accepted={...rejected,review:{passed:true,objectiveFailures:[],issues:[]},artwork:{referenceQAPassed:true}};
 assert.equal(await repairUntilReviewed(accepted,async()=>{throw Error('unneeded');},async()=>{throw Error('unneeded');}),accepted);
 let draws=0;await assert.rejects(()=>repairUntilReviewed(rejected,async()=>idea,async()=>{draws++;return rejected;}),/repeated/);assert.equal(draws,1);
 await assert.rejects(()=>repairUntilReviewed(rejected,async()=>idea,async()=>{throw Error('Actual provider quota pause');}),/Actual provider quota pause/);
 await assert.rejects(()=>repairUntilReviewed<typeof rejected>({...accepted,artwork:undefined},async()=>{throw Error('Missing provenance still requires review');},async()=>accepted),/Missing provenance/);
});
test('continuation identities ignore reports but change with source, runtime or the exact editorial repair',async()=>{
 const root=await mkdtemp(join(tmpdir(),'continuation-identity-'));
 try{await mkdir(join(root,'src'),{recursive:true});await mkdir(join(root,'data/scripts'),{recursive:true});await writeFile(join(root,'src/renderer.ts'),'original');
 const a=await continuationIdentity('bible-noah','123',root);await writeFile(join(root,'report.md'),'new progress');assert.equal(await continuationIdentity('bible-noah','123',root),a);
 await writeFile(join(root,'data/scripts/bible-noah-visual-revisions.json'),'actual correction');const b=await continuationIdentity('bible-noah','123',root);assert.notEqual(b,a);
 assert.notEqual(await continuationIdentity('bible-noah','124',root),b);await writeFile(join(root,'src/renderer.ts'),'fixed');assert.notEqual(await continuationIdentity('bible-noah','123',root),b);
 }finally{await rm(root,{recursive:true,force:true});}
});
