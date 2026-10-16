import React from 'react';
import {AbsoluteFill,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import type {DynamicEdit} from '../../src/editor/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
import {DISPLAY_FONT} from '../compositions/Thumbnail';
// Owner-requested 2026-10-16 dynamic edit. Every frame still shows only the approved FLUX illustration of
// the narrated beat; React adds camera framing, labels and cards, never characters or scenery.
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const stroke=(px:number)=>({WebkitTextStroke:`${px}px #0d0a07`,paintOrder:'stroke fill' as const});
type Beat=DynamicEdit['beats'][number];
const ENTRY=9;

function BeatView({beat,path,frames}:{beat:Beat;path:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const p=Math.min(1,frame/Math.max(1,frames-1)),eased=p*p*(3-2*p);
 const snap=spring({frame,fps,config:{damping:18,stiffness:220,mass:.6}});
 let scale=beat.scale*(1+.035*eased),blur=0,slide=0,opacity=1;
 if(beat.entry==='punch')scale*=1+.08*(1-snap);
 if(beat.entry==='zoom'){const k=interpolate(frame,[0,ENTRY],[1,0],clamp);scale*=1+.45*k*k;blur=10*k;opacity=1-.6*k;}
 if(beat.entry==='whip-left'||beat.entry==='whip-right'){const k=interpolate(frame,[0,ENTRY],[1,0],clamp);slide=(beat.entry==='whip-left'?1:-1)*300*k*k;scale*=1+.3*k;blur=16*k;}
 // The slide stays inside the extra whip scale, so the artwork always covers the frame.
 const limitX=(scale-1)/2*1920,limitY=(scale-1)/2*1080;
 const x=Math.max(-limitX,Math.min(limitX,-scale*(beat.centerX-.5)*1920+beat.drift*22*(eased-.5)));
 const y=Math.max(-limitY,Math.min(limitY,-scale*(beat.centerY-.5)*1080));
 return <AbsoluteFill style={{background:'#0d0a07',overflow:'hidden'}}>
  <Img src={staticFile(path)} style={{position:'absolute',width:1920,height:1080,objectFit:'cover',transformOrigin:'50% 50%',transform:`translate(${Math.max(-limitX,Math.min(limitX,x+slide))}px,${y}px) scale(${scale})`,filter:blur?`blur(${blur.toFixed(1)}px)`:undefined,opacity}}/>
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(13,10,7,.38) 100%)'}}/>
 </AbsoluteFill>;
}

function Pop({text,placement,frames}:{text:string;placement:'top'|'left'|'right';frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:11,stiffness:190,mass:.7}}),exit=interpolate(frame,[frames-6,frames],[1,0],clamp);
 const words=text.toUpperCase().split(/\s+/);
 const side=placement==='left'?{left:90,textAlign:'left' as const}:placement==='right'?{right:90,textAlign:'right' as const}:{left:160,right:160,textAlign:'center' as const};
 return <div style={{position:'absolute',top:50,...side,maxWidth:placement==='top'?undefined:820,fontFamily:DISPLAY_FONT,fontSize:placement==='top'?104:96,lineHeight:1.02,color:'#ffffff',...stroke(16),textShadow:'0 10px 0 #0d0a07',opacity:exit,transform:`scale(${(.35+.65*enter)*(.92+.08*exit)}) rotate(${(placement==='right'?2:-2)*enter}deg)`,transformOrigin:placement==='left'?'0% 50%':placement==='right'?'100% 50%':'50% 50%'}}>
  {words.map((w,i)=><span key={i} style={{color:i===words.length-1?'#ffd21f':undefined}}>{w}{i<words.length-1?' ':''}</span>)}
 </div>;
}

function ChapterCard({number,title,frames}:{number:number;title:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:13,stiffness:150}}),exit=interpolate(frame,[frames-8,frames],[1,0],clamp);
 const title2=spring({frame:frame-5,fps,config:{damping:14,stiffness:140}});
 return <AbsoluteFill style={{opacity:exit}}>
  <AbsoluteFill style={{background:`rgba(13,10,7,${.55*enter})`}}/>
  <div style={{position:'absolute',left:0,right:0,top:250,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:DISPLAY_FONT}}>
   <div style={{width:260,height:260,borderRadius:130,background:'#ffd21f',border:'14px solid #0d0a07',display:'flex',alignItems:'center',justifyContent:'center',fontSize:190,color:'#0d0a07',transform:`scale(${enter}) rotate(${-8+8*enter}deg)`}}>{number}</div>
   <div style={{marginTop:40,maxWidth:1600,textAlign:'center',fontSize:124,lineHeight:1.02,color:'#ffffff',textTransform:'uppercase',...stroke(16),textShadow:'0 10px 0 #0d0a07',transform:`translateY(${(1-title2)*120}px)`,opacity:Math.min(1,title2*1.4)}}>{title}</div>
  </div>
 </AbsoluteFill>;
}

function VerseCard({title,frames}:{title:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=spring({frame,fps,config:{damping:14,stiffness:160}}),exit=interpolate(frame,[frames-8,frames],[1,0],clamp);
 return <div style={{position:'absolute',right:60,top:50,padding:'18px 34px 22px',background:'#f4e4c1',border:'8px solid #0d0a07',borderRadius:18,boxShadow:'0 16px 0 #0d0a07',transform:`translateX(${(1-enter)*700}px) rotate(${-3*enter}deg)`,opacity:exit,fontFamily:DISPLAY_FONT,color:'#2b1d10',textAlign:'center'}}>
  <div style={{fontSize:30,letterSpacing:6,color:'#9b5b21'}}>THE TEXT</div>
  <div style={{fontSize:74,lineHeight:1}}>{title}</div>
 </div>;
}

function Captions({cues}:{cues:Composition['cues']}){
 const {fps}=useVideoConfig(),t=useCurrentFrame()/fps,cue=cues.find(c=>t>=c.start&&t<c.end);if(!cue)return null;
 return <div style={{position:'absolute',left:160,right:160,bottom:70,display:'flex',justifyContent:'center'}}><div style={{fontFamily:DISPLAY_FONT,fontSize:66,lineHeight:1.1,textAlign:'center',color:'#ffffff',textTransform:'uppercase',...stroke(10),textShadow:'0 6px 0 #0d0a07'}}>
  {(cue.words??[{text:cue.text,start:cue.start,end:cue.end}]).map((w,i)=>{const active=t>=w.start&&t<w.end;return <span key={i} style={{display:'inline-block',margin:'0 9px',color:active?'#ffd21f':undefined,transform:active?'scale(1.08)':undefined}}>{w.text}</span>;})}
 </div></div>;
}

export function DynamicVideo(props:Composition&{edit:DynamicEdit}){
 const {fps}=props,edit=props.edit;const frames=(a:number,b:number)=>Math.max(1,Math.round(b*fps)-Math.round(a*fps));
 return <>
  {edit.beats.map((beat,i)=>{const asset=props.assets.find(a=>a.shotId===beat.shotId);if(!asset)throw new Error(`Missing shot asset: ${beat.shotId}`);requireIllustratedArtwork(asset);return <Sequence key={i} from={Math.round(beat.start*fps)} durationInFrames={frames(beat.start,beat.end)}><BeatView beat={beat} path={asset.path} frames={frames(beat.start,beat.end)}/></Sequence>;})}
  {edit.pops.map((pop,i)=><Sequence key={`pop-${i}`} from={Math.round(pop.start*fps)} durationInFrames={frames(pop.start,pop.end)}><Pop text={pop.text} placement={pop.placement} frames={frames(pop.start,pop.end)}/></Sequence>)}
  {edit.cards.map((card,i)=><Sequence key={`card-${i}`} from={Math.round(card.start*fps)} durationInFrames={frames(card.start,card.end)}>{card.kind==='chapter'?<ChapterCard number={card.number??i+1} title={card.title} frames={frames(card.start,card.end)}/>:<VerseCard title={card.title} frames={frames(card.start,card.end)}/>}</Sequence>)}
  <Captions cues={props.cues}/>
 </>;
}
