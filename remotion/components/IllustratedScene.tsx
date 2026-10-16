import React from 'react';
import {AbsoluteFill,Img,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {MediaAsset,Shot} from '../../src/editor/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
import {annotationProgress,illustratedCamera} from '../../src/editor/illustrated-edit';

export function IllustratedScene({shot,asset,frames}:{shot:Shot;asset:MediaAsset;frames:number}){
 requireIllustratedArtwork(asset);
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 const {pan,zoom}=illustratedCamera(shot.motion,frame,frames);
 const label=shot.overlay;
 const placement=asset.editorialCrop?(asset.editorialCrop.placement==='left'?'right':'left'):shot.illustrationIdea?.labelPlacement??'left';
 const right=placement==='right',bottom=placement==='bottom';
 const crop=asset.editorialCrop;const [x1,y1,x2,y2]=crop?.bounds??[0,0,1,1];
 const cropWidth=(x2-x1)*1920,cropHeight=(y2-y1)*1080;
 const scale=Math.min(1250/cropWidth,740/cropHeight);
 const focusX=crop?.placement==='left'?620:1300,focusY=460;
 const arrow=crop&&label?[crop.placement==='left'?.73:.27,.23,focusX/1920,focusY/1080]:shot.overlayArrow;
 const reveal=shot.editorialReframe===1?Math.min(1,frame/18):1;
 const emphasis=shot.editorialReframe===2&&arrow;
 const time=shot.start+frame/fps;
 const progress=shot.editorialTiming?annotationProgress(time,shot.editorialTiming.start,shot.editorialTiming.end):Math.min(1,frame/8);
 // Keep the illustration fully visible on cuts. Only editorial marks enter progressively.
 return <AbsoluteFill style={{background:'#f5edda',overflow:'hidden'}}>
  <AbsoluteFill style={{transform:`scale(${zoom}) translateX(${pan}px)`,transformOrigin:'50% 50%',clipPath:reveal<1?`inset(0 ${100*(1-reveal)}% 0 0)`:undefined}}>
   {crop?<div style={{position:'absolute',left:focusX-cropWidth*scale/2,top:focusY-cropHeight*scale/2,width:cropWidth*scale,height:cropHeight*scale,overflow:'hidden'}}><Img src={staticFile(asset.path)} style={{position:'absolute',left:-x1*1920*scale,top:-y1*1080*scale,width:1920*scale,height:1080*scale,maxWidth:'none'}}/></div>:<Img src={staticFile(asset.path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
  </AbsoluteFill>
  {emphasis&&<svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:progress}}><ellipse cx={arrow[2]*1920} cy={arrow[3]*1080} rx="140" ry="85" fill="#c794431c" stroke="#b65f45" strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress}/></svg>}
  {arrow&&<svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:progress}}><defs><marker id="editorial-tip" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5" fill="#b65f45"/></marker></defs><line x1={arrow[0]*1920} y1={arrow[1]*1080} x2={arrow[2]*1920} y2={arrow[3]*1080} pathLength="1" strokeDasharray="1" strokeDashoffset={1-progress} stroke="#b65f45" strokeWidth="8" strokeLinecap="round" markerEnd={progress>=1?'url(#editorial-tip)':undefined}/></svg>}
  {label&&progress>0&&<div style={{position:'absolute',left:right?undefined:90,right:right?90:undefined,top:bottom?undefined:80,bottom:bottom?230:undefined,maxWidth:700,fontSize:68,fontWeight:900,lineHeight:1.08,color:'#302a25',background:'rgba(245,237,218,.94)',padding:'12px 18px',opacity:progress,transform:`translateY(${8*(1-progress)}px)`}}>{label}<div style={{height:5,width:150*progress,background:'#b65f45',marginTop:10}}/></div>}
 </AbsoluteFill>;
}
