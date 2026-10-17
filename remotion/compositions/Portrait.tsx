import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import type {Shot,MediaAsset,DynamicEdit} from '../../src/editor/schemas';
import {illustratedCamera} from '../../src/editor/illustrated-edit';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
import {ShotView} from '../components/DynamicEdit';
import {DISPLAY_FONT,thumbnailLines,useDisplayFont} from './Thumbnail';
function Art({shot,asset,frames}:{shot:Shot;asset:MediaAsset;frames:number}){
 requireIllustratedArtwork(asset);const frame=useCurrentFrame(),{zoom,pan}=illustratedCamera(shot.motion,frame,frames);
 return <AbsoluteFill style={{overflow:'hidden'}}><Img src={staticFile(asset.path)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',filter:'blur(32px)',opacity:.16,transform:`scale(${1.1+frame/frames*.04})`}}/><div style={{position:'absolute',left:0,right:0,top:350,height:900,transform:`scale(${zoom}) translateX(${pan*.4}px)`}}><Img src={staticFile(asset.path)} style={{width:'100%',height:'100%',objectFit:'contain'}}/></div></AbsoluteFill>;
}
function Legacy(props:Composition){
 const f=useCurrentFrame(),{fps}=useVideoConfig(),t=f/fps,cue=props.cues.find(c=>t>=c.start&&t<c.end);
 return <AbsoluteFill style={{background:'#fdf3d7',fontFamily:'Arial,sans-serif',color:'#241c15'}}>{props.shots.map(s=>{const from=Math.round(s.start*fps),frames=Math.round(s.end*fps)-from,asset=props.assets.find(a=>a.shotId===s.id);if(!asset)throw Error('Missing portrait source');return <Sequence key={s.id} from={from} durationInFrames={frames}><Art shot={s} asset={asset} frames={frames}/></Sequence>;})}<div style={{position:'absolute',left:100,right:100,top:180,fontSize:68,fontWeight:900,lineHeight:1.12}}>{props.thumbnailTitle}</div>{cue&&<div style={{position:'absolute',left:100,right:100,top:1280,textAlign:'center',fontSize:70,lineHeight:1.15,fontWeight:800,color:'#fff7e3',background:'#201d19ed',padding:'20px 24px',borderRadius:20}}>{cue.words?.map((w,i)=><span key={i} style={{color:t>=w.start&&t<w.end?'#ffd060':undefined}}>{w.text}{' '}</span>)}</div>}<div style={{position:'absolute',left:100,right:120,top:1510,fontSize:34,fontWeight:700}}>{t>props.durationInFrames/fps-4?'Full episode on YouTube · @bibleunearthedhq':'Bible Unearthed · illustrated history'}</div><Audio src={staticFile(props.audioMixPath!)}/></AbsoluteFill>;
}

// Owner-requested 2026-10-17 vertical layout: everything that matters sits inside the platform safe zone
// (top 200 px status bar, right 140 px action buttons, bottom 400 px caption/music UI). The full 16:9 artwork
// stays whole in the stage; only its own cut-out actors and the camera move.
const STAGE_TOP=600,STAGE_H=608,S=1080/1920;
const stroke=(px:number)=>({WebkitTextStroke:`${px}px #0d0a07`,paintOrder:'stroke fill' as const});
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

function Hook({title}:{title:string}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const {top,accent}=thumbnailLines(title.replace(/\s*#shorts\b/i,''));
 const a=spring({frame,fps,config:{damping:10,stiffness:200}}),b=spring({frame:frame-5,fps,config:{damping:9,stiffness:200}});
 return <div style={{position:'absolute',left:50,right:140,top:215,textAlign:'center',fontFamily:DISPLAY_FONT,textTransform:'uppercase',lineHeight:.98,...stroke(16),textShadow:'0 10px 0 #0d0a07'}}>
  {top?<div style={{fontSize:top.length>18?84:100,color:'#ffffff',transform:`scale(${a}) rotate(${-2*a}deg)`}}>{top}</div>:null}
  <div style={{fontSize:accent.length>14?108:132,color:'#ffd21f',transform:`scale(${b}) rotate(${2*b}deg)`}}>{accent}</div>
 </div>;
}

function Captions({cues}:{cues:Composition['cues']}){
 const {fps}=useVideoConfig(),t=useCurrentFrame()/fps,cue=cues.find(c=>t>=c.start&&t<c.end);if(!cue)return null;
 const pop=interpolate(t-cue.start,[0,.12],[.85,1],clamp);
 return <div style={{position:'absolute',left:50,right:140,top:1265,display:'flex',justifyContent:'center'}}><div style={{fontFamily:DISPLAY_FONT,fontSize:86,lineHeight:1.06,textAlign:'center',color:'#ffffff',textTransform:'uppercase',...stroke(13),textShadow:'0 8px 0 #0d0a07',transform:`scale(${pop})`}}>
  {(cue.words??[{text:cue.text,start:cue.start,end:cue.end}]).map((w,i)=>{const on=t>=w.start&&t<w.end;return <span key={i} style={{display:'inline-block',margin:'0 10px',color:on?'#ffd21f':undefined,transform:on?'scale(1.1)':undefined}}>{w.text}</span>;})}
 </div></div>;
}

function Sticker({text,frames}:{text:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const enter=spring({frame,fps,config:{damping:10,stiffness:220}}),exit=interpolate(frame,[frames-6,frames],[1,0],clamp);
 const words=text.toUpperCase().split(/\s+/);
 return <div style={{position:'absolute',right:150,top:STAGE_TOP-62,fontFamily:DISPLAY_FONT,fontSize:70,color:'#ffffff',...stroke(12),textShadow:'0 6px 0 #0d0a07',transformOrigin:'100% 50%',transform:`scale(${enter}) rotate(${-3*enter}deg)`,opacity:exit}}>{words.map((w,i)=><span key={i} style={{color:i===words.length-1?'#ffd21f':undefined}}>{w}{i<words.length-1?' ':''}</span>)}</div>;
}

function Chip({title,frames}:{title:string;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const enter=spring({frame,fps,config:{damping:12,stiffness:200}}),exit=interpolate(frame,[frames-6,frames],[1,0],clamp);
 return <div style={{position:'absolute',left:40,top:STAGE_TOP+STAGE_H-80,padding:'8px 20px 10px',background:'#0d0a07',border:'4px solid #ffd21f',borderRadius:14,fontFamily:DISPLAY_FONT,fontSize:44,color:'#ffffff',transformOrigin:'0% 50%',transform:`scale(${enter})`,opacity:exit}}>{title}</div>;
}

function CallToAction({frames}:{frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const enter=spring({frame,fps,config:{damping:9,stiffness:180}}),pulse=1+.04*Math.sin(frame/3.5);
 return <AbsoluteFill style={{opacity:interpolate(frame,[0,4],[0,1],clamp)}}>
  <AbsoluteFill style={{background:'rgba(13,10,7,.45)'}}/>
  <div style={{position:'absolute',left:50,right:140,top:STAGE_TOP+120,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:DISPLAY_FONT,textTransform:'uppercase',transform:`scale(${enter})`}}>
   <div style={{fontSize:76,color:'#ffffff',...stroke(12),textShadow:'0 8px 0 #0d0a07'}}>The full story</div>
   <div style={{marginTop:18,fontSize:64,color:'#0d0a07',background:'#ffd21f',border:'8px solid #0d0a07',borderRadius:22,padding:'14px 34px',transform:`scale(${pulse})`,whiteSpace:'nowrap'}}>Full episode ▶</div>
   <div style={{marginTop:20,fontSize:44,color:'#ffffff',...stroke(8)}}>on the channel</div>
  </div>
 </AbsoluteFill>;
}

function Dynamic(props:Composition&{edit:DynamicEdit}){
 useDisplayFont();
 const frame=useCurrentFrame(),{fps}=props,t=frame/fps,total=props.durationInFrames,edit=props.edit;
 const frames=(a:number,b:number)=>Math.max(1,Math.round(b*fps)-Math.round(a*fps));
 const shots=props.shots.map(shot=>({shot,beats:edit.beats.filter(b=>b.shotId===shot.id),asset:props.assets.find(a=>a.shotId===shot.id)})).filter(s=>s.beats.length);
 const current=shots.find(s=>t>=s.shot.start&&t<s.shot.end)??shots.at(-1)!;
 const cta=Math.max(0,total-Math.round(3.2*fps));
 return <AbsoluteFill style={{background:'#0d0a07',overflow:'hidden'}}>
  {current.asset?<Img src={staticFile(current.asset.path)} style={{position:'absolute',left:-300,top:-100,width:1680,height:2120,objectFit:'cover',filter:'blur(38px) brightness(.5) saturate(1.25)',transform:`scale(${1.05+.03*Math.sin(t*.5)})`}}/>:null}
  <div style={{position:'absolute',left:0,top:STAGE_TOP,width:1080,height:STAGE_H,overflow:'hidden',boxShadow:'0 24px 70px #000c',outline:'6px solid #0d0a07'}}>
   <div style={{position:'absolute',left:0,top:0,width:1920,height:1080,transform:`scale(${S})`,transformOrigin:'0 0'}}>
    {shots.map(({shot,beats,asset})=>{if(!asset)throw new Error(`Missing shot asset: ${shot.id}`);requireIllustratedArtwork(asset);return <Sequence key={shot.id} from={Math.round(shot.start*fps)} durationInFrames={frames(shot.start,shot.end)}><ShotView beats={beats} path={asset.path} layer={edit.layers.find(l=>l.shotId===shot.id)} fps={fps} shotStart={shot.start}/></Sequence>;})}
   </div>
  </div>
  <div style={{position:'absolute',left:0,top:STAGE_TOP+STAGE_H,height:10,width:1080*frame/total,background:'#ffd21f'}}/>
  <Hook title={props.thumbnailTitle??''}/>
  {edit.pops.map((p,i)=><Sequence key={`p${i}`} from={Math.round(p.start*fps)} durationInFrames={frames(p.start,p.end)}><Sticker text={p.text} frames={frames(p.start,p.end)}/></Sequence>)}
  {edit.cards.map((c,i)=><Sequence key={`c${i}`} from={Math.round(c.start*fps)} durationInFrames={frames(c.start,c.end)}><Chip title={c.title} frames={frames(c.start,c.end)}/></Sequence>)}
  <Captions cues={props.cues}/>
  <Sequence from={cta}><CallToAction frames={total-cta}/></Sequence>
  {props.audioMixPath?<Audio src={staticFile(props.audioMixPath)}/>:null}
 </AbsoluteFill>;
}

export function Portrait(props:Composition){return props.edit?<Dynamic {...props} edit={props.edit}/>:<Legacy {...props}/>;}
