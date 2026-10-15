import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import type {Shot,MediaAsset} from '../../src/editor/schemas';
import {illustratedCamera} from '../../src/editor/illustrated-edit';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
function Art({shot,asset,frames}:{shot:Shot;asset:MediaAsset;frames:number}){
 requireIllustratedArtwork(asset);const frame=useCurrentFrame(),{zoom,pan}=illustratedCamera(shot.motion,frame,frames);
 return <AbsoluteFill style={{overflow:'hidden'}}><Img src={staticFile(asset.path)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',filter:'blur(32px)',opacity:.16,transform:`scale(${1.1+frame/frames*.04})`}}/><div style={{position:'absolute',left:0,right:0,top:350,height:900,transform:`scale(${zoom}) translateX(${pan*.4}px)`}}><Img src={staticFile(asset.path)} style={{width:'100%',height:'100%',objectFit:'contain'}}/></div></AbsoluteFill>;
}
export function Portrait(props:Composition){
 const f=useCurrentFrame(),{fps}=useVideoConfig(),t=f/fps,cue=props.cues.find(c=>t>=c.start&&t<c.end);
 return <AbsoluteFill style={{background:'#fdf3d7',fontFamily:'Arial,sans-serif',color:'#241c15'}}>{props.shots.map(s=>{const from=Math.round(s.start*fps),frames=Math.round(s.end*fps)-from,asset=props.assets.find(a=>a.shotId===s.id);if(!asset)throw Error('Missing portrait source');return <Sequence key={s.id} from={from} durationInFrames={frames}><Art shot={s} asset={asset} frames={frames}/></Sequence>;})}<div style={{position:'absolute',left:100,right:100,top:180,fontSize:68,fontWeight:900,lineHeight:1.12}}>{props.thumbnailTitle}</div>{cue&&<div style={{position:'absolute',left:100,right:100,top:1280,textAlign:'center',fontSize:70,lineHeight:1.15,fontWeight:800,color:'#fff7e3',background:'#201d19ed',padding:'20px 24px',borderRadius:20}}>{cue.words?.map((w,i)=><span key={i} style={{color:t>=w.start&&t<w.end?'#ffd060':undefined}}>{w.text}{' '}</span>)}</div>}<div style={{position:'absolute',left:100,right:120,top:1510,fontSize:34,fontWeight:700}}>{t>props.durationInFrames/fps-4?'Full episode on YouTube · @bibleunearthedhq':'Bible Unearthed · illustrated history'}</div><Audio src={staticFile(props.audioMixPath!)}/></AbsoluteFill>;
}
