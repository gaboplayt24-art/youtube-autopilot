import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captionGroups,framing,buildHyperframesProject} from '../src/render/hyperframes';
import {exec} from '../src/orchestration/io';

const words=(text:string,start:number,step=.3)=>text.split(' ').map((t,i)=>({text:t,start:start+i*step,end:start+i*step+.25}));
test('captions group 3-5 words, break at sentence ends and never overlap',()=>{
 const g=captionGroups([...words('Can a prophet be angry at mercy?',0),...words('The story begins not with a storm',3)]);
 assert.ok(g.every(x=>x.words.length>=1&&x.words.length<=5));
 assert.equal(g[1].words.at(-1)!.text,'mercy?','a sentence end closes its group');
 for(let i=1;i<g.length;i++)assert.ok(g[i].start>=g[i-1].end-1e-9,'one group visible at a time');
});
test('framing keeps the artwork covering the frame at every scale',()=>{
 for(const scale of [1.04,1.26,1.4])for(const cx of [0,.5,1]){const f=framing({shotId:'s',start:0,end:2,scale,centerX:cx,centerY:cx,drift:1,entry:'cut'},1);
  assert.ok(Math.abs(f.x)<=(f.scale-1)/2*1920+1&&Math.abs(f.y)<=(f.scale-1)/2*1080+1);}
});
test('the generated project is offline, deterministic and registers one paused root timeline',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hf-')),pub=join(dir,'public');
 try{
  await mkdir(join(pub,'run'),{recursive:true});await mkdir(join(pub,'fonts'),{recursive:true});
  await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=64x36','-frames:v','1',join(pub,'run','s0.png')]);
  await copyFile('public/fonts/Anton-Regular.ttf',join(pub,'fonts','Anton-Regular.ttf')).catch(()=>copyFile(join(pub,'run','s0.png'),join(pub,'fonts','Anton-Regular.ttf')));
  const comp={fps:30,width:1920,height:1080,durationInFrames:120,scenes:[],shots:[{id:'s0',sceneId:'c1',start:0,end:4,narration:'n',visualIntent:'v',shotType:'generated-image',motion:'parallax',assetPrompt:'p',overlay:null,keywords:[],highImpact:false,transition:'cut'}],
   assets:[{shotId:'s0',path:'run/s0.png'}],cues:[{sceneId:'c1',start:0,end:2,text:'Hello there friend.',words:words('Hello there friend.',.2)}],
   edit:{version:'dynamic-v1',beats:[{shotId:'s0',start:0,end:2,scale:1.1,centerX:.5,centerY:.5,drift:1,entry:'cut'},{shotId:'s0',start:2,end:4,scale:1.2,centerX:.4,centerY:.5,drift:-1,entry:'glide'}],pops:[{start:1,end:3,text:'Unwanted Mercy',placement:'right'}],cards:[{kind:'chapter',start:2,end:3.5,title:'Flight',number:1}],layers:[],sfx:[],presenter:[]}} as never;
  const out=join(dir,'hf'),built=await buildHyperframesProject(comp,pub,out);
  const html=await readFile(join(out,'index.html'),'utf8');
  assert.equal(built.shots,1);assert.equal(built.captionGroups,1);
  assert.ok(!/https?:\/\/(?!hyperframes\.heygen\.com)/.test(html.replace(/xmlns="[^"]*"/g,'')),'no network fetches at render time');
  assert.ok(!/Math\.random|Date\.now|repeat:\s*-1/.test(html),'deterministic timeline');
  assert.equal((html.match(/window\.__timelines\['main'\]=tl/g)??[]).length,1);
  assert.match(html,/data-duration="4"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
