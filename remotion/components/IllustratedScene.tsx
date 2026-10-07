import React from 'react';
import {AbsoluteFill,Img,staticFile,useCurrentFrame} from 'remotion';
import type {MediaAsset,Shot} from '../../src/editor/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
export function IllustratedScene({shot,asset,frames}:{shot:Shot;asset:MediaAsset;frames:number}){
 requireIllustratedArtwork(asset);
 const frame=useCurrentFrame(),progress=Math.min(1,frame/Math.max(1,frames));
 const pan=shot.motion==='pan-left'?-18*progress:shot.motion==='pan-right'?18*progress:0;
 const zoom=shot.motion==='pull-out'?1.035-.02*progress:1.01+.02*progress;
 const label=shot.overlay,placement=shot.illustrationIdea?.labelPlacement??'left',right=placement==='right',bottom=placement==='bottom';
 const arrow=shot.overlayArrow;
 return <AbsoluteFill style={{background:'#f5edda'}}><AbsoluteFill style={{transform:`scale(${zoom}) translateX(${pan}px)`,transformOrigin:'50% 50%'}}><Img src={staticFile(asset.path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>{arrow&&<svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:Math.min(1,frame/12)}}><defs><marker id="editorial-tip" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5" fill="#b65f45"/></marker></defs><line x1={arrow[0]*1920} y1={arrow[1]*1080} x2={arrow[2]*1920} y2={arrow[3]*1080} stroke="#b65f45" strokeWidth="8" strokeLinecap="round" markerEnd="url(#editorial-tip)"/></svg>}{label&&<div style={{position:'absolute',left:right?undefined:90,right:right?90:undefined,top:bottom?undefined:80,bottom:bottom?150:undefined,maxWidth:700,fontSize:68,fontWeight:900,lineHeight:1.08,color:'#302a25',textShadow:'0 2px 4px #f5edda',opacity:Math.min(1,frame/8),transform:`translateY(${10*(1-Math.min(1,frame/8))}px)`}}>{label}<div style={{height:6,width:150,background:'#b65f45',marginTop:10}}/></div>}</AbsoluteFill>;
}
