import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planDynamicEdit,splitShot,frameCenter,verseReferences} from '../src/editor/dynamic-edit';
import {detailCentroid,quietZone} from '../src/editor/focus';
import {synthesize,sfxTrack} from '../src/audio/sfx-library';
import {dynamicEdit,type Shot} from '../src/editor/schemas';
import {chapterTitles} from '../src/editor/dynamic-edit-stage';

const words=(text:string,start:number,step=.4)=>text.split(' ').map((t,i)=>({text:t,start:start+i*step,end:start+i*step+.35}));
const shot=(id:string,sceneId:string,start:number,end:number,overlay:string|null=null):Shot=>({id,sceneId,start,end,narration:'narrated text',visualIntent:'a scene',shotType:'generated-image',motion:'parallax',assetPrompt:'a scene prompt',overlay,keywords:[],highImpact:false,transition:'cut',...(overlay?{editorialTiming:{start:start+.5,end,anchor:overlay}}:{})});

test('a long shot is split at spoken phrase ends into beats of at least 1.5 seconds',()=>{
 const spoken=words('In Genesis, two figures arrive at the gate. Lot rises to meet them, and bows low.',0);
 const cuts=splitShot(shot('a','c1',0,6.4),spoken);
 assert.ok(cuts.length>=1);
 const bounds=[0,...cuts,6.4];for(let i=1;i<bounds.length;i++)assert.ok(bounds[i]-bounds[i-1]>=1.5);
 assert.ok(cuts.every(c=>spoken.some(w=>Math.abs(w.end-c)<.001)),'cuts land on actual word ends');
});

test('a short shot stays one beat',()=>{assert.deepEqual(splitShot(shot('a','c1',0,3),words('one two three four five six',0)),[]);});

test('the framed window never leaves the artwork',()=>{
 for(const scale of [1.05,1.24,1.34])for(const f of [[0,0],[1,1],[.5,.5]] as [number,number][]){
  const {centerX,centerY}=frameCenter(scale,f,1);const half=1/(2*scale);
  assert.ok(centerX-half>=-1e-4&&centerX+half<=1+1e-4);assert.ok(centerY-half>=-1e-4&&centerY+half<=1+1e-4);
 }
});

test('verse cards use a spoken reference, else the scene\'s own cited claim, and skip possessives',()=>{
 const spoken=[...words('check Isaiah 6:2 to confirm',0),...words("Isaiah’s vision and Genesis, figures",10)];
 const refs=verseReferences(spoken,[{id:'c1',start:0,claims:[{text:'Genesis 19:1-3 describes a meal.'}]}]);
 assert.deepEqual(refs.map(r=>r.title),['ISAIAH 6:2','GENESIS 19:1-3']);
});

test('the plan validates, places a chapter card per later scene, and never overlaps a label with a card',()=>{
 const shots=[shot('s0','c1',0,7,'Hidden in plain sight'),shot('s1','c2',7,14,'At the gate'),shot('s2','c2',14,20)];
 const spoken=words('Why do angels look like guests? In Genesis, figures arrive. Lot meets them at the gate, and they eat bread together that night. Later they leave the city at dawn.',0,.6);
 const plan=dynamicEdit.parse(planDynamicEdit({shots,words:spoken,scenes:[{id:'c1',start:0},{id:'c2',start:7}],titles:{c2:'Guests at the Gate'},focus:{s0:[.3,.4]},zones:{s1:'left'}}));
 assert.equal(plan.cards.filter(c=>c.kind==='chapter').length,1);
 assert.ok(plan.pops.every(p=>!plan.cards.some(c=>p.start<c.end&&p.end>c.start)));
 assert.equal(plan.beats[0].start,0);assert.equal(plan.beats.at(-1)!.end,20);
 for(let i=1;i<plan.beats.length;i++)assert.equal(plan.beats[i].start,plan.beats[i-1].end,'beats tile the timeline');
 assert.ok(plan.sfx.some(s=>s.type==='boom'));
 for(let i=1;i<plan.sfx.length;i++)assert.ok(plan.sfx[i].time-plan.sfx[i-1].time>=.4);
});

test('focus and quiet zone come from the image detail',()=>{
 const W=96,H=54,gray=new Uint8Array(W*H);
 for(let y=10;y<20;y++)for(let x=60;x<80;x++)gray[y*W+x]=(x+y)%2?255:0;
 const [fx]=detailCentroid(gray,W,H);assert.ok(fx>.55);
 assert.equal(quietZone(gray,W,H),'left');
});

test('synthesized effects are deterministic, finite and peak-normalized',()=>{
 for(const type of ['whoosh','pop','boom','shimmer','paper'] as const){
  const a=synthesize(type),b=synthesize(type);assert.deepEqual(a,b);
  const peak=a.reduce((m,v)=>Math.max(m,Math.abs(v)),0);assert.ok(peak>.85&&peak<=.9001&&a.every(Number.isFinite));
 }
 const track=sfxTrack([{time:.1,type:'boom'},{time:.2,type:'whoosh'}],2);assert.ok(track.every(v=>v>=-1&&v<=1));
});

test('the angels re-edit chapter titles are short and belong to their run',async()=>{
 const titles=await chapterTitles('bible-angels-001');assert.equal(Object.keys(titles).length,5);
 assert.deepEqual(await chapterTitles('no-such-run'),{});
});

test('a layered shot glides instead of cutting, staggers its actors and points arrows only at an upright figure',()=>{
 const shots=[shot('s0','c1',0,8,'Hidden in plain sight'),shot('s1','c1',8,14,'A simple meal')];
 const spoken=words('Why do angels look like guests? In Genesis, figures arrive at a house. They eat bread together, and nobody notices anything unusual at all tonight.',0,.6);
 const layers={s0:{background:'r/layers/s0/bg.png',actors:[{path:'r/layers/s0/actor-0.png',x:.1,y:.3,width:.12,height:.5},{path:'r/layers/s0/actor-1.png',x:.5,y:.3,width:.12,height:.5}]},s1:{background:'r/layers/s1/bg.png',actors:[{path:'r/layers/s1/actor-0.png',x:.3,y:.4,width:.5,height:.5}]}};
 const plan=dynamicEdit.parse(planDynamicEdit({shots,words:spoken,scenes:[{id:'c1',start:0}],titles:{},focus:{},layers,presenter:['p0','p1','p2']}));
 assert.ok(plan.beats.filter(b=>b.shotId==='s0').slice(1).every(b=>b.entry==='glide'));
 assert.deepEqual(plan.layers[0].actors.map(a=>a.delay),[0,.22]);
 assert.ok(plan.pops.find(p=>p.text==='Hidden in plain sight')?.target,'upright lead figure gets an arrow');
 assert.equal(plan.pops.find(p=>p.text==='A simple meal')?.target,undefined,'a wide group gets no arrow');
 assert.equal(plan.presenter.length,3);
});

test('a clip slice re-times the full edit, keeps only its own shots and never carries chapter cards or the presenter',async()=>{
 const {sliceEdit}=await import('../src/editor/dynamic-edit');
 const edit=dynamicEdit.parse({version:'dynamic-v1',beats:[{shotId:'a',start:0,end:10,scale:1.1,centerX:.5,centerY:.5,drift:1,entry:'cut'},{shotId:'b',start:10,end:20,scale:1.1,centerX:.5,centerY:.5,drift:1,entry:'zoom'},{shotId:'c',start:20,end:30,scale:1.1,centerX:.5,centerY:.5,drift:1,entry:'glide'}],pops:[{start:12,end:14,text:'Six wings',placement:'top'}],cards:[{kind:'chapter',start:10,end:12,title:'Two',number:2},{kind:'verse',start:15,end:20,title:'ISAIAH 6:2'}],layers:[{shotId:'b',background:'r/b.png',actors:[{path:'r/a.png',x:.1,y:.1,width:.2,height:.5,entry:'pop',delay:0}]},{shotId:'c',background:'r/c.png',actors:[{path:'r/c0.png',x:.1,y:.1,width:.2,height:.5,entry:'pop',delay:0}]}],sfx:[{time:9,type:'whoosh'},{time:12,type:'pop'}],presenter:['p']});
 const clip=sliceEdit(edit,11,19);
 assert.deepEqual(clip.beats.map(b=>[b.shotId,b.start,b.end,b.entry]),[['b',0,8,'cut']]);
 assert.deepEqual(clip.cards.map(c=>c.kind),['verse']);assert.equal(clip.pops[0].start,1);
 assert.deepEqual(clip.layers.map(l=>l.shotId),['b']);assert.deepEqual(clip.sfx,[{time:1,type:'pop'}]);assert.deepEqual(clip.presenter,[]);
});
