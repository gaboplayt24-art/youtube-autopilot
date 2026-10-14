import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directIllustratedEdit,spokenLabelStart,illustratedCamera,annotationProgress,endsVisualPhrase} from '../src/editor/illustrated-edit';
import {shot,profile} from '../src/editor/schemas';
import {composition} from '../src/orchestration/schemas';
import {visualQuality} from '../src/editor/quality';
import history from '../config/visual-profiles/history.json';
const example=shot.parse({id:'beat',sceneId:'chapter',start:10,end:14,narration:'Isaiah describes six wings.',visualIntent:'Illustrated figure with six wings',shotType:'generated-image',motion:'pan-right',assetPrompt:'Original illustrated figure with wings',overlay:'Six wings',keywords:['wings'],highImpact:false,transition:'blur'});
const words=[{text:'Isaiah',start:10,end:10.5},{text:'describes',start:10.6,end:11},{text:'six',start:11.3,end:11.7},{text:'wings.',start:11.8,end:12.2}];
test('callouts enter on actual spoken phrase, preserving narration, asset identity and duration',()=>{
 const edited=directIllustratedEdit([example],words)[0];
 assert.deepEqual(edited.editorialTiming,{start:11.3,end:14,anchor:'Six wings'});
 assert.equal(edited.transition,'cut');assert.equal(edited.narration,example.narration);assert.equal(edited.start,10);assert.equal(edited.end,14);assert.equal(edited.assetPrompt,example.assetPrompt);
});
test('paraphrased label requires an exact measured anchor; unmatched labels have no fabricated timing',()=>{
 const anchored=directIllustratedEdit([{...example,overlay:'A different vision',overlayAnchor:'six wings'}],words)[0];
 assert.equal(anchored.editorialTiming?.start,11.3);
 const unanchored=directIllustratedEdit([{...example,overlay:'Four wings'}],words)[0];
 assert.equal(unanchored.overlay,null);assert.equal(unanchored.editorialTiming,undefined);
 assert.equal(spokenLabelStart('six faces',words),undefined);
});
test('word matching ignores punctuation and case but preserves factual lexical differences',()=>{
 assert.equal(spokenLabelStart('SIX WINGS!',words),11.3);
 assert.equal(spokenLabelStart('six wing',words),undefined);
 assert.equal(spokenLabelStart('6 wings',words),undefined);
});
test('no borrowing anchor timestamps from neighbouring beats or flashing a late label',()=>{
 assert.equal(directIllustratedEdit([example],words.map(w=>({...w,start:w.start-10,end:w.end-10})))[0].overlay,null);
 assert.equal(directIllustratedEdit([{...example,end:12.5}],words)[0].overlay,'Six wings');
 assert.equal(directIllustratedEdit([{...example,end:11.8}],words)[0].overlay,null);
});
test('annotations are hidden before speech and after shot, with a short progressive entrance',()=>{
 assert.equal(annotationProgress(11,11.3,14),0);
 assert.equal(annotationProgress(11.39,11.3,14).toFixed(1),'0.5');
 assert.equal(annotationProgress(12,11.3,14),1);
 assert.equal(annotationProgress(14,11.3,14),0);
});
test('camera honors pan direction and pull-out while staying bounded even outside the shot',()=>{
 assert.ok(illustratedCamera('pan-left',89,90).pan<0);
 assert.ok(illustratedCamera('pan-right',89,90).pan>0);
 assert.ok(illustratedCamera('pull-out',89,90).zoom<illustratedCamera('pull-out',0,90).zoom);
 for(const f of [-30,0,45,90,1000]){const c=illustratedCamera('pan-right',f,90);assert.ok(c.zoom>=1.015&&c.zoom<=1.035);assert.ok(c.pan>=0&&c.pan<=12);}
});
test('visual QA rejects made-up label timestamps and permits verified speech anchors',()=>{
 const s=directIllustratedEdit([example],words)[0];
 const c=composition.parse({width:1920,height:1080,fps:30,durationInFrames:420,scenes:[],cues:[{sceneId:'chapter',start:10,end:12.2,text:example.narration,words}],shots:[s],assets:[],visualProfile:profile.parse(history)});
 const check=(v:typeof c)=>visualQuality(v).checks.find(c=>c.name==='editorial speech timing')!.passed;
 assert.equal(check(c),true);
 assert.equal(check({...c,shots:[{...s,editorialTiming:{...s.editorialTiming!,start:10.2}}]}),false);
 assert.equal(check({...c,shots:[{...s,editorialTiming:{...s.editorialTiming!,end:15}}]}),false);
});

test('phrase cuts prefer measured pauses or punctuation but respect the visual hold ceiling',()=>{
 const current={text:'wings,',start:2.5,end:3.2};const next={text:'while',start:3.24,end:3.5};
 assert.equal(endsVisualPhrase(current,next,3.2,2.8,4.2),true);
 assert.equal(endsVisualPhrase({...current,text:'wings'},next,3.2,2.8,4.2),false);
 assert.equal(endsVisualPhrase({...current,text:'wings'},{...next,start:3.4},3.2,2.8,4.2),true);
 assert.equal(endsVisualPhrase({...current,text:'wings'},next,4,2.8,4.2),true);
 assert.equal(endsVisualPhrase(current,next,2,2.8,4.2),false);
});

test('long-form phrase planning retains every aligned word and continuous chapter coverage',async()=>{
 const {ShotPlanner}=await import('../src/editor/planner');
 const timed=Array.from({length:400},(_,i)=>({text:i%13===12?'word.':'word',start:i*.4,end:(i+1)*.4}));
 const narration=timed.map(w=>w.text).join(' ');
 const plan=await new ShotPlanner().plan({scenes:[{id:'chapter',narration,visual:'An original biblical illustration'}]},{scenes:[{id:'chapter',path:'unused.wav',duration:160,words:timed,alignment:timed}]},profile.parse(history),30,undefined,false,undefined,true);
 assert.equal(plan.shots.map(s=>s.narration).join(' '),narration);
 assert.equal(plan.shots[0].start,0);assert.equal(plan.shots.at(-1)!.end,160);
 for(let i=1;i<plan.shots.length;i++)assert.equal(plan.shots[i].start,plan.shots[i-1].end);
 assert.ok(plan.shots.every(s=>s.end-s.start<=(s.start<30?4.2:7.5)+.001));
});
