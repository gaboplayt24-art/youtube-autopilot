// Owner-requested 2026-10-31: HyperFrames (Apache-2.0, HTML + GSAP rendered frame by frame) as the renderer for the
// dynamic edit, replacing Remotion. The edit plan, approved illustrations, cut-outs, narration and mix are unchanged;
// only how they are animated changes, following HyperFrames motion craft: role-based eases, real motion blur,
// transitions with a cause, per-word title entrances, grouped captions with hard kills, drawn arrows.
import {copyFile,mkdir,rm,writeFile} from 'node:fs/promises';
import {exec} from '../orchestration/io';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import type {Composition} from '../orchestration/schemas';
import type {DynamicEdit} from '../editor/schemas';

type Beat=DynamicEdit['beats'][number];
type Window={from:number;to:number};
const W=1920,H=1080;
const r=(n:number)=>Math.round(n*1000)/1000;
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Same framing as the Remotion edit: the beat's window, clamped so the artwork always covers the frame. */
export function framing(beat:Beat,p:number){
 const e=p*p*(3-2*p),scale=beat.scale*(1+.03*e),limitX=(scale-1)/2*W,limitY=(scale-1)/2*H;
 const clamp=(v:number,l:number)=>Math.max(-l,Math.min(l,v));
 return {scale:r(scale),x:r(clamp(-scale*(beat.centerX-.5)*W+beat.drift*20*(e-.5),limitX)),y:r(clamp(-scale*(beat.centerY-.5)*H,limitY))};
}
const toScreen=(f:{scale:number;x:number;y:number},[px,py]:[number,number])=>[W/2+(px-.5)*W*f.scale+f.x,H/2+(py-.5)*H*f.scale+f.y] as const;

/** Caption groups: 3–5 words, broken at a sentence end or a pause of 150 ms or more. */
export function captionGroups(words:{text:string;start:number;end:number}[]){
 const groups:{start:number;end:number;words:typeof words}[]=[];let cur:typeof words=[];
 const flush=()=>{if(cur.length)groups.push({start:cur[0].start,end:cur.at(-1)!.end,words:cur});cur=[];};
 words.forEach((w,i)=>{cur.push(w);const next=words[i+1];if(cur.length>=5||/[.!?;:]["')\]]?$/.test(w.text)&&cur.length>=2||next&&next.start-w.end>=.15&&cur.length>=3||!next)flush();});
 return groups.map((g,i)=>({...g,end:Math.min(g.end+.25,groups[i+1]?.start??g.end+.25)}));
}

/** Writes a self-contained HyperFrames project for the composition (or a time window of it, for previews). */
export async function buildHyperframesProject(c:Composition&{edit:DynamicEdit},publicDir:string,out:string,win?:Window,withAudio=true){
 const from=win?.from??0,to=win?.to??c.durationInFrames/c.fps,dur=r(to-from),edit=c.edit;
 const inWin=(a:number,b:number)=>b>from&&a<to,local=(t:number)=>r(Math.max(0,t-from));
 await mkdir(join(out,'assets','fonts'),{recursive:true});
 const copied=new Set<string>();
 const asset=async(path:string)=>{const target=join('assets',path);if(!copied.has(path)){copied.add(path);await mkdir(dirname(join(out,target)),{recursive:true});await copyFile(join(publicDir,path),join(out,target));}return target;};
 await copyFile(join(publicDir,'fonts','Anton-Regular.ttf'),join(out,'assets','fonts','Anton-Regular.ttf'));
 await copyFile(join(dirname(createRequire(import.meta.url).resolve('gsap/package.json')),'dist','gsap.min.js'),join(out,'assets','gsap.min.js'));

 const html:string[]=[],plan:Record<string,unknown>[]=[];
 let z=1;
 // Shots: plate (parallax 0.6) and actors on their own camera wrapper.
 for(const shot of c.shots.filter(s=>inWin(s.start,s.end))){
  const beats=edit.beats.filter(b=>b.shotId===shot.id&&inWin(b.start,b.end));if(!beats.length)continue;
  const a=c.assets.find(x=>x.shotId===shot.id);if(!a)throw Error('Missing shot asset: '+shot.id);
  const layer=edit.layers.find(l=>l.shotId===shot.id),id='s'+plan.length;
  const start=local(Math.max(shot.start,from)),d=r(Math.min(shot.end,to)-Math.max(shot.start,from));
  const actors=layer?await Promise.all(layer.actors.map(async(ac,k)=>`<img id="${id}a${k}" class="actor" src="${await asset(ac.path)}" alt="" style="left:${r(ac.x*W)}px;top:${r(ac.y*H)}px;width:${r(ac.width*W)}px;height:${r(ac.height*H)}px">`)):[];
  html.push(`<div id="${id}" class="clip shot" data-start="${start}" data-duration="${d}" data-track-index="1" style="z-index:${z++}"><div id="${id}p" class="plate"><img src="${await asset(layer?.background??a.path)}" alt=""></div><div id="${id}c" class="cam">${actors.join('')}</div><div class="vignette"></div></div>`);
  plan.push({id,start,actors:(layer?.actors??[]).map((ac,k)=>({id:`${id}a${k}`,entry:ac.entry,idle:ac.idle,delay:ac.delay,lead:ac.lead})),layered:!!layer,beats:beats.map(b=>({start:local(Math.max(b.start,from))-start,end:r(Math.min(b.end,to)-Math.max(shot.start,from)),entry:b.start<from?'cut':b.entry,a:framing(b,0),b:framing(b,1)}))});
 }
 // Pops: per-word blur-in, a drawn arrow to an upright lead figure when the plan names one.
 const pops=edit.pops.filter(p=>inWin(p.start,p.end)).map((p,i)=>{
  const id='pop'+i,start=local(p.start),d=r(Math.min(p.end,to)-Math.max(p.start,from)),words=p.text.toUpperCase().split(/\s+/);
  const side=p.placement==='left'?'left:90px;text-align:left':p.placement==='right'?'right:90px;text-align:right':'left:160px;right:160px;text-align:center';
  const beat=edit.beats.find(b=>p.start>=b.start&&p.start<b.end);let arrow='';
  if(p.target&&beat){const anchor:[number,number]=p.placement==='left'?[330,230]:p.placement==='right'?[1590,230]:[960,235];const t=toScreen(framing(beat,.2),p.target);const dx=t[0]-anchor[0],dy=t[1]-anchor[1],dist=Math.hypot(dx,dy);
   if(dist>170){const end=[anchor[0]+dx*(1-90/dist),anchor[1]+dy*(1-90/dist)],bend=[(anchor[0]+end[0])/2-dy*.18,(anchor[1]+end[1])/2+dx*.18],ang=Math.atan2(end[1]-bend[1],end[0]-bend[0]);
    const head=`M${r(end[0]+Math.cos(ang+2.6)*40)} ${r(end[1]+Math.sin(ang+2.6)*40)} L${r(end[0])} ${r(end[1])} L${r(end[0]+Math.cos(ang-2.6)*40)} ${r(end[1]+Math.sin(ang-2.6)*40)}`,path=`M${anchor[0]} ${anchor[1]} Q${r(bend[0])} ${r(bend[1])} ${r(end[0])} ${r(end[1])}`;
    arrow=`<svg class="arrow" viewBox="0 0 ${W} ${H}"><path class="ln" d="${path}" pathLength="1"/><path class="lk" d="${path}" pathLength="1"/><path class="hd" d="${head}"/><path class="hk" d="${head}"/></svg>`;}}
  html.push(`<div id="${id}" class="clip pop" data-start="${start}" data-duration="${d}" data-track-index="3" data-layout-allow-overlap style="z-index:500">${arrow}<div class="label" style="${side};font-size:${p.placement==='top'?100:92}px">${words.map((w,k)=>`<span class="w${k===words.length-1?' hi':''}">${esc(w)}</span>`).join(' ')}</div></div>`);
  return {id,start,d,arrow:!!arrow};
 });
 // Chapter cards flood the frame; a quiet header then names the chapter until the next one. Verse chips are footnotes.
 const chapters=edit.cards.filter(k=>k.kind==='chapter'),cards=edit.cards.filter(k=>inWin(k.start,k.end)).map((k,i)=>{
  const id='card'+i,start=local(k.start),d=r(Math.min(k.end,to)-Math.max(k.start,from));
  html.push(k.kind==='chapter'?`<div id="${id}" class="clip chapter" data-start="${start}" data-duration="${d}" data-track-index="4" style="z-index:600"><div class="flood"></div><div class="num">${k.number??i+1}</div><div class="ctitle">${esc(k.title).split('').map(ch=>`<span>${ch===' '?'&nbsp;':ch}</span>`).join('')}</div></div>`
   :`<div id="${id}" class="clip verse" data-start="${start}" data-duration="${d}" data-track-index="4" style="z-index:550"><div class="chip">${esc(k.title)}</div></div>`);
  return {id,start,kind:k.kind,d};
 });
 chapters.forEach((k,i)=>{const until=chapters[i+1]?.start??c.durationInFrames/c.fps;if(!inWin(k.end,until))return;
  html.push(`<div id="head${i}" class="clip header" data-start="${local(Math.max(k.end,from))}" data-duration="${r(Math.min(until,to)-Math.max(k.end,from))}" data-track-index="5" style="z-index:450"><div class="htext"><b>${k.number??i+1}.</b> ${esc(k.title)}</div></div>`);});
 // Captions: one group visible at a time, the spoken word in the accent colour, a hard kill after each exit.
 const words=c.cues.flatMap(q=>q.words??[{text:q.text,start:q.start,end:q.end}]).filter(w=>inWin(w.start,w.end));
 const groups=captionGroups(words).map((g,i)=>{const id='cap'+i;
  html.push(`<div id="${id}" class="clip cap" data-start="${local(g.start)}" data-duration="${r(g.end-g.start)}" data-track-index="6" style="z-index:700"><div class="line">${g.words.map((w,k)=>`<span id="${id}w${k}">${esc(w.text)}</span>`).join(' ')}</div></div>`);
  return {id,start:local(g.start),d:r(g.end-g.start),words:g.words.map(w=>r(w.start-g.start))};});

 const audio=withAudio&&c.audioMixPath?`<audio id="mix" class="clip" src="${await asset(c.audioMixPath)}" data-start="0" data-media-start="${r(from)}" data-duration="${dur}" data-volume="1"></audio>`:'';
 const page=`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=${W}, height=${H}">
<script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:"Anton";src:url("assets/fonts/Anton-Regular.ttf") format("truetype")}
:root{--ink:#0d0a07;--paper:#ffffff;--accent:#ffd21f;--display:"Anton","Archivo Black",sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--ink)}
#root{position:relative;width:100%;height:100%;overflow:hidden;font-family:var(--display)}
.shot{position:absolute;inset:0;overflow:hidden;background:var(--ink)}
.plate,.cam{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:50% 50%}
.plate img{width:100%;height:100%;object-fit:cover;display:block}
.actor{position:absolute;transform-origin:50% 100%}
.vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 58%,rgba(13,10,7,.36) 100%)}
.pop{position:absolute;inset:0}
.label{position:absolute;top:110px;max-width:820px;line-height:1.02;color:var(--paper);-webkit-text-stroke:16px var(--ink);paint-order:stroke fill;text-shadow:0 10px 0 var(--ink)}
.label .w{display:inline-block;margin:0 8px}.label .hi{color:var(--accent)}
.arrow{position:absolute;inset:0;width:${W}px;height:${H}px}
.arrow path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.arrow .ln,.arrow .hd{stroke:var(--paper);stroke-width:20}.arrow .lk,.arrow .hk{stroke:var(--ink);stroke-width:9}
.arrow .ln,.arrow .lk{stroke-dasharray:1;stroke-dashoffset:1}
.chapter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.chapter .flood{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(255,210,31,.92),rgba(13,10,7,.9) 62%)}
.chapter .num{position:relative;width:250px;height:250px;border-radius:50%;background:var(--accent);border:14px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:180px;color:var(--ink)}
.chapter .ctitle{position:relative;margin-top:40px;max-width:1300px;text-align:center;font-size:118px;line-height:1.02;color:var(--paper);text-transform:uppercase;-webkit-text-stroke:16px var(--ink);paint-order:stroke fill;text-shadow:0 10px 0 var(--ink)}
.chapter .ctitle span{display:inline-block}
.verse{position:absolute;inset:0}
.chip{position:absolute;left:44px;top:36px;padding:10px 26px 12px;background:var(--ink);border-radius:16px;border:4px solid var(--accent);font-size:50px;line-height:1;color:var(--paper);letter-spacing:1px;transform-origin:0% 50%}
.header{position:absolute;inset:0}
.htext{position:absolute;left:0;right:0;top:30px;text-align:center;font-size:44px;color:var(--paper);text-transform:uppercase;letter-spacing:1px;-webkit-text-stroke:8px var(--ink);paint-order:stroke fill;text-shadow:0 4px 0 var(--ink)}
.htext b{color:var(--accent);font-weight:400}
.cap{position:absolute;inset:0}
.line{position:absolute;left:0;right:0;bottom:96px;padding:0 240px;text-align:center;font-size:60px;line-height:1.1;color:var(--paper);text-transform:uppercase;-webkit-text-stroke:9px var(--ink);paint-order:stroke fill;text-shadow:0 5px 0 var(--ink);overflow:visible}
.line span{display:inline-block;margin:0 10px}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${dur}" data-width="${W}" data-height="${H}" data-fps="${c.fps}" data-motion-blur="on">
${html.join('\n')}
${audio}
</div>
<script>
const PLAN=${JSON.stringify({shots:plan,pops,cards,groups})};
const tl=gsap.timeline({paused:true});
const at=(id)=>document.getElementById(id);
for(const s of PLAN.shots){
 const cam=at(s.id+'c'),plate=at(s.id+'p'),T=(t)=>s.start+t;
 const set=(f,t)=>{tl.set(cam,{scale:f.scale,x:f.x,y:f.y},T(t));tl.set(plate,{scale:1.04+.6*(f.scale-1),x:f.x*.6,y:f.y*.6},T(t));};
 s.beats.forEach((b,k)=>{
  const len=Math.max(.05,b.end-b.start);
  // Entry by role: a punch lands on a long tail, a glide eases both ways, a zoom or whip arrives blurred and sharpens.
  if(b.entry==='glide'&&k>0){const g=Math.min(.55,len);tl.to(cam,{scale:b.a.scale,x:b.a.x,y:b.a.y,duration:g,ease:'power2.inOut'},T(b.start));tl.to(plate,{scale:1.04+.6*(b.a.scale-1),x:b.a.x*.6,y:b.a.y*.6,duration:g,ease:'power2.inOut'},T(b.start));}
  else if(b.entry==='punch'){set({...b.a,scale:b.a.scale*1.08},b.start);tl.to([cam],{scale:b.a.scale,duration:.35,ease:'expo.out'},T(b.start));}
  else if(b.entry==='zoom'){set({...b.a,scale:b.a.scale*1.35},b.start);tl.fromTo(at(s.id),{opacity:.35},{opacity:1,duration:.3,ease:'power3.out'},T(b.start));tl.to(cam,{scale:b.a.scale,duration:.32,ease:'power3.out'},T(b.start));tl.to(plate,{scale:1.04+.6*(b.a.scale-1),duration:.32,ease:'power3.out'},T(b.start));}
  else if(b.entry==='whip-left'||b.entry==='whip-right'){const dir=b.entry==='whip-left'?1:-1;set({...b.a,x:b.a.x+dir*260},b.start);tl.to(cam,{x:b.a.x,duration:.24,ease:'power3.out'},T(b.start));tl.to(plate,{x:b.a.x*.6,duration:.24,ease:'power3.out'},T(b.start));}
  else set(b.a,b.start);
  // Inside the beat the world keeps moving: a slow push toward the beat's end framing.
  const settle=b.entry==='glide'&&k>0?Math.min(.55,len):b.entry==='cut'?0:.35;
  if(len-settle>.2){tl.to(cam,{scale:b.b.scale,x:b.b.x,y:b.b.y,duration:len-settle,ease:'sine.inOut'},T(b.start+settle));tl.to(plate,{scale:1.04+.6*(b.b.scale-1),x:b.b.x*.6,y:b.b.y*.6,duration:len-settle,ease:'sine.inOut'},T(b.start+settle));}
});
 for(const a of s.actors){
  const el=at(a.id),t0=T(a.delay);
  const from={pop:{scale:.86,y:0,rotation:0,x:0},rise:{y:90,scale:1,rotation:0,x:0},drop:{y:-120,scale:1,rotation:0,x:0},swing:{rotation:-9,y:0,scale:1,x:0},'slide-left':{x:-500,y:0,scale:1,rotation:0},'slide-right':{x:500,y:0,scale:1,rotation:0}}[a.entry]||{y:0,scale:1,rotation:0,x:0};
  tl.fromTo(el,{...from,opacity:0},{x:0,y:0,scale:1,rotation:0,opacity:1,duration:a.entry==='drop'?.6:.5,ease:a.entry==='drop'?'back.out(1.6)':'back.out(1.3)'},t0);
  // Acting, not decoration: a small weight shift on the lead figure at each new framing.
  if(a.lead)s.beats.slice(1).forEach(b=>{if(b.start>a.delay+.5)tl.fromTo(el,{y:0},{y:-12,duration:.16,ease:'power2.out',yoyo:true,repeat:1},T(b.start));});
 }
}
for(const p of PLAN.pops){
 const root=at(p.id),ws=root.querySelectorAll('.w'),ln=root.querySelectorAll('.ln,.lk'),hd=root.querySelectorAll('.hd,.hk');
 const S=p.start;
 tl.fromTo(ws,{opacity:0,filter:'blur(6px)',scale:1.08},{opacity:1,filter:'blur(0px)',scale:1,duration:.16,ease:'power4.out',stagger:.067},S);
 if(p.arrow){tl.fromTo(ln,{strokeDashoffset:1},{strokeDashoffset:0,duration:.35,ease:'power2.inOut'},S);tl.fromTo(hd,{opacity:0},{opacity:1,duration:.08},S+.35);}
 tl.to([...ws,...ln,...hd],{opacity:0,filter:'blur(6px)',duration:.18,ease:'power2.in'},S+Math.max(.3,p.d-.2));
}
for(const k of PLAN.cards){
 const root=at(k.id),S=k.start;
 if(k.kind==='chapter'){const fl=root.querySelector('.flood'),num=root.querySelector('.num'),ls=root.querySelectorAll('.ctitle span');
  tl.fromTo(fl,{opacity:0,scale:1.15},{opacity:1,scale:1,duration:.4,ease:'power2.inOut'},S);
  tl.fromTo(num,{scale:0,rotation:-25},{scale:1,rotation:0,duration:.6,ease:'back.out(1.7)'},S+.1);
  tl.fromTo(ls,{opacity:.3,filter:'blur(4px)',y:20},{opacity:1,filter:'blur(0px)',y:0,duration:.25,ease:'power3.out',stagger:.03},S+.3);
  tl.to([fl,num,...ls],{opacity:0,duration:.25,ease:'power2.in'},S+Math.max(.8,k.d-.27));}
 else{const chip=root.querySelector('.chip');tl.fromTo(chip,{scale:.6,opacity:0,filter:'blur(8px)'},{scale:1,opacity:1,filter:'blur(0px)',duration:.35,ease:'back.out(1.5)'},S);tl.to(chip,{opacity:0,duration:.2,ease:'power2.in'},S+Math.max(.4,k.d-.22));}
}
for(const g of PLAN.groups){
 const root=at(g.id),line=root.querySelector('.line'),S=g.start;
 tl.fromTo(line,{opacity:0,y:14},{opacity:1,y:0,duration:.12,ease:'power3.out'},S);
 g.words.forEach((w,i)=>{const el=at(g.id+'w'+i);tl.fromTo(el,{color:'#ffffff',scale:1},{color:'#ffd21f',scale:1.08,duration:.08,ease:'power2.out'},S+w);if(g.words[i+1]!==undefined)tl.to(el,{color:'#ffffff',scale:1,duration:.08},S+g.words[i+1]);});
 tl.to(line,{opacity:0,duration:.1,ease:'power2.in'},S+Math.max(.12,g.d-.1));
}
window.__timelines=window.__timelines||{};
window.__timelines['main']=tl;
</script>
</body></html>
`;
 await writeFile(join(out,'index.html'),page);
 await writeFile(join(out,'hyperframes.json'),JSON.stringify({$schema:'https://hyperframes.heygen.com/schema/hyperframes.json',paths:{blocks:'compositions',components:'compositions/components',assets:'assets'},media:{autoProxy:true}},null,2));
 await writeFile(join(out,'meta.json'),JSON.stringify({id:'episode',name:'episode'},null,2));
 return {out,duration:dur,shots:plan.length,pops:pops.length,cards:cards.length,captionGroups:groups.length};
}

/** Renders the picture with HyperFrames, then adds the approved mastered mix unchanged: the HyperFrames mixer
 * re-levels audio (measured −11.9 LUFS against the −15 LUFS master), which would fail the unchanged audio QA. */
export async function renderHyperframes(c:Composition&{edit:DynamicEdit},publicDir:string,path:string,win?:Window){
 const work=path+'.hyperframes',silent=path+'.picture.mp4';await rm(work,{recursive:true,force:true});
 const built=await buildHyperframesProject(c,publicDir,work,win,false);
 const cli=join(dirname(createRequire(import.meta.url).resolve('hyperframes/package.json')),'bin','hyperframes.mjs');
 await exec(process.execPath,[cli,'telemetry','disable'],{cwd:work,timeout:60000}).catch(()=>undefined);
 await exec(process.execPath,[cli,'render','-o',silent,'-q','delivery','--quiet'],{cwd:work,timeout:Math.max(20*60000,built.duration*8*1000),maxBuffer:64*1024*1024});
 if(c.audioMixPath)await exec('ffmpeg',['-y','-v','error','-i',silent,'-ss',String(win?.from??0),'-t',String(built.duration),'-i',join(publicDir,c.audioMixPath),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest',path],{timeout:10*60000});
 else await copyFile(silent,path);
 await rm(silent,{force:true});await rm(work,{recursive:true,force:true});
 return built;
}
