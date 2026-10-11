import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
import {DISPLAY_FONT,thumbnailLines,useDisplayFont} from './Thumbnail';
// Owner-authorized 2026-10-11: a vertical 1080x1920 Short cut from the QA-passed video. The full 16:9 illustration stays
// visible (no source crop); a blurred copy fills the vertical frame behind it. Labels are Remotion overlays, never AI-baked.
const ART_TOP=560,ART_HEIGHT=608;
function ShortShot({path,frames}:{path:string;frames:number}){
 const frame=useCurrentFrame(),zoom=1+.05*Math.min(1,frame/Math.max(1,frames));
 return <AbsoluteFill><Img src={staticFile(path)} style={{position:'absolute',inset:-60,width:1200,height:2040,objectFit:'cover',filter:'blur(30px) brightness(.5) saturate(1.2)'}}/>
  <div style={{position:'absolute',left:0,top:ART_TOP,width:1080,height:ART_HEIGHT,overflow:'hidden',boxShadow:'0 20px 60px #000a'}}><Img src={staticFile(path)} style={{width:1080,height:ART_HEIGHT,objectFit:'cover',transform:`scale(${zoom})`}}/></div></AbsoluteFill>;
}
function ShortCaptions({cues,offset}:{cues:Composition['cues'];offset:number}){
 const {fps}=useVideoConfig(),t=useCurrentFrame()/fps+offset,cue=cues.find(c=>t>=c.start&&t<c.end);if(!cue)return null;
 return <div style={{position:'absolute',left:60,right:60,top:ART_TOP+ART_HEIGHT+90,display:'flex',justifyContent:'center'}}><div style={{fontFamily:DISPLAY_FONT,fontSize:76,lineHeight:1.12,textAlign:'center',color:'#ffffff',textTransform:'uppercase',WebkitTextStroke:'10px #0d0a07',paintOrder:'stroke fill'}}>{(cue.words??[{text:cue.text,start:cue.start,end:cue.end}]).map((w,i)=><span key={i} style={{display:'inline-block',margin:'0 10px',color:t>=w.start&&t<w.end?'#ffd21f':undefined}}>{w.text}</span>)}</div></div>;
}
export const Short:React.FC<Composition>=(props)=>{
 useDisplayFont();
 const window=props.short;if(!window)throw new Error('Short requires an approved window');
 const {fps}=props,frame=useCurrentFrame(),first=Math.round(window.startSeconds*fps),last=Math.round(window.endSeconds*fps),total=last-first;
 const {top,accent}=thumbnailLines(window.title.replace(/\s*#shorts\b/i,''));
 const endCard=Math.max(0,total-Math.round(3*fps)),pulse=1+.04*Math.sin(frame/4);
 return <AbsoluteFill style={{background:'#0d0a07'}}>
  {props.shots.filter(s=>s.end>window.startSeconds&&s.start<window.endSeconds).map(shot=>{const asset=props.assets.find(a=>a.shotId===shot.id);if(!asset)throw new Error(`Missing shot asset: ${shot.id}`);requireIllustratedArtwork(asset);const from=Math.max(0,Math.round(shot.start*fps)-first),to=Math.min(total,Math.round(shot.end*fps)-first);return <Sequence key={shot.id} from={from} durationInFrames={Math.max(1,to-from)}><ShortShot path={asset.path} frames={to-from}/></Sequence>;})}
  <div style={{position:'absolute',left:60,right:60,top:150,fontFamily:DISPLAY_FONT,textAlign:'center',lineHeight:.95,textTransform:'uppercase',WebkitTextStroke:'14px #0d0a07',paintOrder:'stroke fill',textShadow:'0 10px 0 #0d0a07'}}>
   {top?<div style={{fontSize:top.length>16?96:118,color:'#ffffff'}}>{top}</div>:null}<div style={{fontSize:accent.length>14?110:140,color:'#ffd21f'}}>{accent}</div>
  </div>
  <ShortCaptions cues={props.cues} offset={window.startSeconds}/>
  {frame>=endCard?<div style={{position:'absolute',left:0,right:0,bottom:150,display:'flex',justifyContent:'center',opacity:interpolate(frame,[endCard,endCard+8],[0,1],{extrapolateRight:'clamp'})}}><div style={{fontFamily:DISPLAY_FONT,fontSize:58,whiteSpace:'nowrap',color:'#0d0a07',background:'#ffd21f',padding:'18px 36px',borderRadius:18,transform:`scale(${pulse})`,textTransform:'uppercase'}}>Full story on the channel ▶</div></div>:null}
  {props.audioMixPath?<Audio src={staticFile(props.audioMixPath)} trimBefore={first} trimAfter={last} volume={f=>interpolate(f,[total-18,total],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>:null}
 </AbsoluteFill>;
};
