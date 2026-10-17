import React from 'react';
import {AbsoluteFill,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import type {DynamicEdit} from '../../src/editor/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
import {DISPLAY_FONT} from '../compositions/Thumbnail';
// Owner-requested 2026-10-16 dynamic edit, modelled on the owner's reference video's principles: scenes built
// from pieces that enter on the narration, actors that never stand still, soft depth of field, persistent chapter
// header and verse chip. Every character and prop is the approved FLUX illustration's own pixels (cut out locally);
// React adds only camera, labels, arrows and cards.
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const stroke=(px:number)=>({WebkitTextStroke:`${px}px #0d0a07`,paintOrder:'stroke fill' as const});
type Beat=DynamicEdit['beats'][number];
type Layer=DynamicEdit['layers'][number];
type Camera={scale:number;x:number;y:number;blur:number;opacity:number};
const ENTRY=9,GLIDE=.55;
const ease=(p:number)=>p*p*(3-2*p);

function framing(beat:Beat,p:number){
 const e=ease(Math.max(0,Math.min(1,p)));const scale=beat.scale*(1+.03*e);
 const limitX=(scale-1)/2*1920,limitY=(scale-1)/2*1080;
 return {scale,x:Math.max(-limitX,Math.min(limitX,-scale*(beat.centerX-.5)*1920+beat.drift*20*(e-.5))),y:Math.max(-limitY,Math.min(limitY,-scale*(beat.centerY-.5)*1080))};
}

/** Camera for a shot at absolute time t: beat framings, glides between them, punch snaps and shot-entry transitions. */
export function cameraAt(beats:Beat[],t:number,fps:number):Camera{
 const k=Math.max(0,beats.findIndex(b=>t>=b.start&&t<b.end));const beat=beats[k]??beats[0];
 const local=t-beat.start,p=local/Math.max(.01,beat.end-beat.start);let {scale,x,y}=framing(beat,p);let blur=0,opacity=1;
 const frame=local*fps;
 if(beat.entry==='glide'&&k>0&&local<GLIDE){const from=framing(beats[k-1],1),m=ease(local/GLIDE);scale=from.scale+(scale-from.scale)*m;x=from.x+(x-from.x)*m;y=from.y+(y-from.y)*m;}
 if(beat.entry==='punch'){const snap=spring({frame,fps,config:{damping:18,stiffness:220,mass:.6}});scale*=1+.08*(1-snap);}
 if(beat.entry==='zoom'){const q=interpolate(frame,[0,ENTRY],[1,0],clamp);scale*=1+.45*q*q;blur=10*q;opacity=1-.6*q;}
 if(beat.entry==='whip-left'||beat.entry==='whip-right'){const q=interpolate(frame,[0,ENTRY],[1,0],clamp);const limit=(scale*(1+.3*q)-1)/2*1920;scale*=1+.3*q;x=Math.max(-limit,Math.min(limit,x+(beat.entry==='whip-left'?1:-1)*300*q*q));blur=16*q;}
 return {scale,x,y,blur,opacity};
}
const toScreen=(c:Camera,[px,py]:[number,number])=>[960+(px-.5)*1920*c.scale+c.x,540+(py-.5)*1080*c.scale+c.y] as const;

function Actor({actor,index,hops}:{actor:Layer['actors'][number];index:number;hops:number[]}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const t=frame/fps,local=frame-Math.round(actor.delay*fps);
 if(local<0)return null;
 const enter=spring({frame:local,fps,config:{damping:actor.entry==='drop'?9:12,stiffness:260,mass:.6}});
 const left=actor.x*1920,top=actor.y*1080,width=actor.width*1920,height=actor.height*1080;
 let dx=0,dy=0,s=1,turn=0;
 // Each actor sharpens out of its own softened copy: a quick focus pull rather than a second figure.
 if(actor.entry==='pop')s=.88+.12*enter;
 if(actor.entry==='rise')dy=(1-enter)*90;
 if(actor.entry==='drop')dy=-(1-enter)*120;
 if(actor.entry==='swing')turn=(1-enter)*-9;
 if(actor.entry==='slide-left')dx=-(1-enter)*(left+width+60);
 if(actor.entry==='slide-right')dx=(1-enter)*(1920-left+60);
 const appear=Math.min(1,enter*2.2);
 // Idle life differs per actor so a group never moves in unison.
 const phase=index*1.7,w=(f:number)=>Math.sin(2*Math.PI*f*t+phase);
 let bob=0,sway=0,breath=1+.01*w(.45);
 if(actor.idle==='float'){bob=w(.5)*4;sway=w(.33)*.6;}
 if(actor.idle==='sway'){sway=w(.4)*1.6;bob=w(.8)*2;}
 if(actor.idle==='breathe'){breath=1+.022*w(.38);sway=w(.2)*.4;}
 if(actor.idle==='hop'){const cycle=(t+phase)%2.6;bob=cycle<.32?-Math.sin(Math.PI*cycle/.32)*10:0;sway=w(.3)*.5;}
 // The lead figure reacts when the camera moves on: a small hop with squash and stretch.
 let squash=1;if(actor.lead)for(const h of hops){const d=t-h;if(d>=0&&d<.36){const k=Math.sin(Math.PI*d/.36);bob-=k*12;squash=1+(d<.08?-.05:.04)*k;}}
 return <>
  <div style={{position:'absolute',left:left+width*.15,top:top+height-height*.03,width:width*.7,height:Math.max(14,height*.06),borderRadius:'50%',background:'rgba(13,10,7,.22)',filter:'blur(6px)',opacity:appear,transform:`translateX(${dx}px) scaleX(${.9+.1*Math.cos(2*Math.PI*.5*t+phase)-Math.min(0,bob)/200})`}}/>
  <Img src={staticFile(actor.path)} style={{position:'absolute',left,top,width,height,transformOrigin:'50% 100%',transform:`translate(${dx}px,${dy+bob*enter}px) rotate(${sway*enter+turn}deg) scale(${s/Math.sqrt(squash)},${s*breath*squash})`,opacity:appear}}/>
 </>;
}

export function ShotView({beats,path,layer,fps,shotStart}:{beats:Beat[];path:string;layer?:Layer;fps:number;shotStart:number}){
 const frame=useCurrentFrame();const c=cameraAt(beats,shotStart+frame/fps,fps);
 const filter=c.blur?`blur(${c.blur.toFixed(1)}px)`:undefined;
 if(!layer)return <AbsoluteFill style={{background:'#0d0a07',overflow:'hidden'}}>
  <Img src={staticFile(path)} style={{position:'absolute',width:1920,height:1080,objectFit:'cover',transformOrigin:'50% 50%',transform:`translate(${c.x}px,${c.y+Math.sin(frame/fps*2*Math.PI*.3)*3}px) scale(${c.scale*1.02}) rotate(${Math.sin(frame/fps*2*Math.PI*.18)*.3}deg)`,filter,opacity:c.opacity}}/>
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(13,10,7,.38) 100%)'}}/>
 </AbsoluteFill>;
 // Depth: the softened plate moves at 60% of the camera, the actors at 100%.
 const bgScale=1.04+.6*(c.scale-1);
 return <AbsoluteFill style={{background:'#0d0a07',overflow:'hidden',filter,opacity:c.opacity}}>
  <Img src={staticFile(layer.background)} style={{position:'absolute',width:1920,height:1080,objectFit:'cover',transformOrigin:'50% 50%',transform:`translate(${c.x*.6}px,${c.y*.6}px) scale(${bgScale})`}}/>
  <div style={{position:'absolute',width:1920,height:1080,transformOrigin:'50% 50%',transform:`translate(${c.x}px,${c.y}px) scale(${c.scale})`}}>
   {layer.actors.map((a,i)=><Actor key={a.path} actor={a} index={i} hops={beats.slice(1).map(b=>b.start-shotStart)}/>)}
  </div>
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 45%,transparent 60%,rgba(13,10,7,.32) 100%)'}}/>
 </AbsoluteFill>;
}

function Pop({pop,frames,camera}:{pop:DynamicEdit['pops'][number];frames:number;camera:(t:number)=>Camera|undefined}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:11,stiffness:190,mass:.7}}),exit=interpolate(frame,[frames-6,frames],[1,0],clamp);
 const words=pop.text.toUpperCase().split(/\s+/),placement=pop.placement;
 const side=placement==='left'?{left:90,textAlign:'left' as const}:placement==='right'?{right:90,textAlign:'right' as const}:{left:160,right:160,textAlign:'center' as const};
 const top=placement==='top'?120:110;
 // A drawn arrow from the label to the lead actor's head, like an editor's annotation.
 const c=camera(pop.start+frame/fps);const target=pop.target&&c?toScreen(c,pop.target):undefined;
 const anchor:[number,number]=placement==='left'?[330,top+120]:placement==='right'?[1590,top+120]:[960,top+125];
 let arrow:React.ReactNode=null;
 if(target){const dx=target[0]-anchor[0],dy=target[1]-anchor[1],d=Math.hypot(dx,dy);
  if(d>170){const end:[number,number]=[anchor[0]+dx*(1-90/d),anchor[1]+dy*(1-90/d)];const bend:[number,number]=[(anchor[0]+end[0])/2-dy*.18,(anchor[1]+end[1])/2+dx*.18];
   const draw=interpolate(frame,[3,13],[0,1],clamp);const angle=Math.atan2(end[1]-bend[1],end[0]-bend[0]);
   const head=(r:number)=>`M${end[0]+Math.cos(angle+2.6)*r} ${end[1]+Math.sin(angle+2.6)*r} L${end[0]} ${end[1]} L${end[0]+Math.cos(angle-2.6)*r} ${end[1]+Math.sin(angle-2.6)*r}`;
   const path=`M${anchor[0]} ${anchor[1]} Q${bend[0]} ${bend[1]} ${end[0]} ${end[1]}`;
   arrow=<svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:1920,height:1080,opacity:exit}}>
    <path d={path} fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1-draw}/>
    <path d={path} fill="none" stroke="#0d0a07" strokeWidth="9" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1-draw}/>
    {draw>=1?<><path d={head(40)} fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/><path d={head(40)} fill="none" stroke="#0d0a07" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></>:null}
   </svg>;}}
 return <>{arrow}<div style={{position:'absolute',top,...side,maxWidth:placement==='top'?undefined:820,fontFamily:DISPLAY_FONT,fontSize:placement==='top'?100:92,lineHeight:1.02,color:'#ffffff',...stroke(16),textShadow:'0 10px 0 #0d0a07',opacity:exit,transform:`scale(${(.35+.65*enter)*(.92+.08*exit)}) rotate(${(placement==='right'?2:-2)*enter}deg)`,transformOrigin:placement==='left'?'0% 50%':placement==='right'?'100% 50%':'50% 50%'}}>
  {words.map((w,i)=><span key={i} style={{color:i===words.length-1?'#ffd21f':undefined}}>{w}{i<words.length-1?' ':''}</span>)}
 </div></>;
}

function Presenter({poses,frames}:{poses:string[];frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const t=frame/fps;
 const walk=interpolate(frame,[0,20],[1,0],{...clamp,easing:p=>1-(1-p)**3}),out=interpolate(frame,[frames-12,frames],[0,1],clamp);
 const pose=frame<20?poses[1]??poses[0]:poses[2]??poses[0];const bob=frame<20?Math.abs(Math.sin(t*14))*-14:Math.sin(t*3)*4;
 return <Img src={staticFile(pose)} style={{position:'absolute',right:120,bottom:-10,height:640,transformOrigin:'50% 100%',transform:`translate(${(walk+out)*900}px,${bob}px)`}}/>;
}

function ChapterCard({number,title,frames,poses}:{number:number;title:string;frames:number;poses:string[]}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:13,stiffness:150}}),exit=interpolate(frame,[frames-8,frames],[1,0],clamp);
 const title2=spring({frame:frame-5,fps,config:{damping:14,stiffness:140}});
 return <AbsoluteFill style={{opacity:exit}}>
  <AbsoluteFill style={{background:`rgba(13,10,7,${.6*enter})`}}/>
  <div style={{position:'absolute',left:poses.length?100:0,right:poses.length?620:0,top:230,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:DISPLAY_FONT}}>
   <div style={{width:250,height:250,borderRadius:125,background:'#ffd21f',border:'14px solid #0d0a07',display:'flex',alignItems:'center',justifyContent:'center',fontSize:180,color:'#0d0a07',transform:`scale(${enter}) rotate(${-8+8*enter}deg)`}}>{number}</div>
   <div style={{marginTop:36,maxWidth:1200,textAlign:'center',fontSize:118,lineHeight:1.02,color:'#ffffff',textTransform:'uppercase',...stroke(16),textShadow:'0 10px 0 #0d0a07',transform:`translateY(${(1-title2)*120}px)`,opacity:Math.min(1,title2*1.4)}}>{title}</div>
  </div>
  {poses.length?<Presenter poses={poses} frames={frames}/>:null}
 </AbsoluteFill>;
}

/** Small persistent chip, like a footnote: which passage is on screen right now. */
function VerseChip({title,frames}:{title:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:12,stiffness:200}}),exit=interpolate(frame,[frames-8,frames],[1,0],clamp);
 return <div style={{position:'absolute',left:44,top:36,padding:'10px 26px 12px',background:'#0d0a07',borderRadius:16,border:'4px solid #ffd21f',fontFamily:DISPLAY_FONT,fontSize:50,lineHeight:1,color:'#ffffff',letterSpacing:1,transformOrigin:'0% 50%',transform:`scale(${enter})`,opacity:exit}}>{title}</div>;
}

function ChapterHeader({number,title}:{number:number;title:string}){
 const frame=useCurrentFrame();const enter=interpolate(frame,[0,10],[0,1],clamp);
 return <div style={{position:'absolute',left:0,right:0,top:30,display:'flex',justifyContent:'center',opacity:enter}}><div style={{fontFamily:DISPLAY_FONT,fontSize:44,color:'#ffffff',...stroke(8),textShadow:'0 4px 0 #0d0a07',textTransform:'uppercase',letterSpacing:1}}><span style={{color:'#ffd21f'}}>{number}.</span> {title}</div></div>;
}

function Captions({cues}:{cues:Composition['cues']}){
 const {fps}=useVideoConfig(),t=useCurrentFrame()/fps,cue=cues.find(c=>t>=c.start&&t<c.end);if(!cue)return null;
 return <div style={{position:'absolute',left:200,right:200,bottom:56,display:'flex',justifyContent:'center'}}><div style={{fontFamily:DISPLAY_FONT,fontSize:56,lineHeight:1.1,textAlign:'center',color:'#ffffff',textTransform:'uppercase',...stroke(9),textShadow:'0 5px 0 #0d0a07'}}>
  {(cue.words??[{text:cue.text,start:cue.start,end:cue.end}]).map((w,i)=>{const active=t>=w.start&&t<w.end;return <span key={i} style={{display:'inline-block',margin:'0 8px',color:active?'#ffd21f':undefined}}>{w.text}</span>;})}
 </div></div>;
}

export function DynamicVideo(props:Composition&{edit:DynamicEdit}){
 const {fps}=props,edit=props.edit,poses=edit.presenter;const frames=(a:number,b:number)=>Math.max(1,Math.round(b*fps)-Math.round(a*fps));
 const shots=props.shots.map(shot=>({shot,beats:edit.beats.filter(b=>b.shotId===shot.id)})).filter(s=>s.beats.length);
 const camera=(t:number)=>{const s=shots.find(x=>t>=x.shot.start&&t<x.shot.end);return s?cameraAt(s.beats,t,fps):undefined;};
 const chapters=edit.cards.filter(c=>c.kind==='chapter');const end=props.durationInFrames/fps;
 return <>
  {shots.map(({shot,beats})=>{const asset=props.assets.find(a=>a.shotId===shot.id);if(!asset)throw new Error(`Missing shot asset: ${shot.id}`);requireIllustratedArtwork(asset);const n=frames(shot.start,shot.end);return <Sequence key={shot.id} from={Math.round(shot.start*fps)} durationInFrames={n}><ShotView beats={beats} path={asset.path} layer={edit.layers.find(l=>l.shotId===shot.id)} fps={fps} shotStart={shot.start}/></Sequence>;})}
  {chapters.map((c,i)=>{const until=chapters[i+1]?.start??end;return <Sequence key={`head-${i}`} from={Math.round(c.end*fps)} durationInFrames={frames(c.end,until)}><ChapterHeader number={c.number??i+1} title={c.title}/></Sequence>;})}
  {edit.pops.map((pop,i)=><Sequence key={`pop-${i}`} from={Math.round(pop.start*fps)} durationInFrames={frames(pop.start,pop.end)}><Pop pop={pop} frames={frames(pop.start,pop.end)} camera={camera}/></Sequence>)}
  {edit.cards.map((card,i)=><Sequence key={`card-${i}`} from={Math.round(card.start*fps)} durationInFrames={frames(card.start,card.end)}>{card.kind==='chapter'?<ChapterCard number={card.number??i+1} title={card.title} frames={frames(card.start,card.end)} poses={poses}/>:<VerseChip title={card.title} frames={frames(card.start,card.end)}/>}</Sequence>)}
  <Captions cues={props.cues}/>
 </>;
}
