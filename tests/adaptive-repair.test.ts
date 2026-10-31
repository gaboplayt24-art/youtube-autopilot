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
test('a correction refused by prompt QA before drawing is re-planned with those issues, not retried blindly',async()=>{
 const seen:(string[]|undefined)[]=[];let draws=0;
 const accepted={...rejected,review:{passed:true,objectiveFailures:[],issues:[]},artwork:{referenceQAPassed:true}};
 const result=await repairUntilReviewed(rejected,async(_last,issues)=>{seen.push(issues);return {...idea,concept:idea.concept+' Plan '+seen.length};},async()=>{draws++;if(draws===1)throw Error('Native prompt QA failed before asset spending: example-auto-1 ["Modern setting conflicts with ancient dress"]');return accepted;});
 assert.equal(result,accepted);assert.deepEqual(seen,[undefined,['Modern setting conflicts with ancient dress']]);
});
test('only an unnamed, planner-invented cast may be dropped from a correction',async()=>{
 const {peopleOptional}=await import('../src/visuals/adaptive-repair');
 assert.equal(peopleOptional({...idea,narration:'That is the story\'s own conclusion.',characterRoles:['Modern Reader']}),true);
 assert.equal(peopleOptional({...idea,narration:'Noah builds the ark with his sons.',characterRoles:['Noah']}),false);
 assert.equal(peopleOptional({...idea,characterRoles:[]}),false);
});
test('a provider safety refusal is re-planned as a calmer concept, never accepted',async()=>{
 const {flaggedAttempt,FLAG_GUIDANCE}=await import('../src/visuals/adaptive-repair');
 const refused=flaggedAttempt(idea,'Cloudflare HTTP 400 for flux: 3030 AiError: Your output has been flagged.');
 assert.equal(refused.source.path,'');assert.equal(refused.review.passed,false);assert.deepEqual(refused.review.objectiveFailures,['providerSafetyFlag']);
 const issuesSeen:(string[]|undefined)[]=[];let n=0;
 const result=await repairUntilReviewed(refused as typeof rejected,async(_last,issues)=>{issuesSeen.push(issues);return {...idea,concept:idea.concept+' calmer '+(++n)};},async()=>{if(n===1)throw Error('Cloudflare HTTP 400: 3030 AiError: Your output has been flagged');return {...rejected,review:{passed:true,objectiveFailures:[],issues:[]},artwork:{referenceQAPassed:true}};});
 assert.equal(result.review.passed,true);assert.deepEqual(issuesSeen,[undefined,[FLAG_GUIDANCE]]);
});
test('a regeneration counts the people a role names instead of one per role',async()=>{
 const {castPhrase}=await import('../src/visuals/illustrated-video-assets');
 assert.equal(castPhrase(['Eli']),'Exactly 1 adult character');
 assert.equal(castPhrase(['Three princes']),'Exactly 3 adult characters');
 assert.equal(castPhrase(['Eli','2 guards']),'Exactly 3 adult characters');
 assert.equal(castPhrase(['Noah','his sons']),'Only these adult characters','a plural group is never forced to a wrong exact count');
});

test('a first concept refused by prompt QA becomes an imageless rejection carrying the exact issues', async()=>{
 const {promptRefusedAttempt}=await import('../src/visuals/adaptive-repair');
 const r=promptRefusedAttempt({id:'chapter-2-shot-12',concept:'Daniel at a stone window'},'Native prompt QA failed before asset spending: chapter-2-shot-12 ["Mudbrick, not stone","Conflicting costume"]');
 assert.ok(r);assert.equal(r!.review.passed,false);assert.equal(r!.artwork,null);assert.equal(r!.source.path,'');
 assert.deepEqual(r!.review.issues,['Mudbrick, not stone','Conflicting costume']);assert.deepEqual(r!.review.objectiveFailures,['promptQA']);
 assert.equal(promptRefusedAttempt({id:'x',concept:'y'},'Some other failure'),null);
});
