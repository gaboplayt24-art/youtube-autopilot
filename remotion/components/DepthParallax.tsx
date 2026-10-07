import React from 'react';
import {AbsoluteFill,Img,staticFile,interpolate,useCurrentFrame} from 'remotion';
import type {MediaAsset} from '../../src/editor/schemas';
/** Real estimated depth masks, rather than two copies of the complete photograph. */
export function DepthParallax({asset,frames,direction=1,reframe=0}:{asset:MediaAsset;frames:number;direction?:number;reframe?:number}){
 const f=useCurrentFrame();const t=interpolate(f,[0,Math.max(1,frames-1)],[-.5,.5],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});const layers=asset.depthLayers!;
 // Relative motion of the real depth masks supplies parallax. A tiny rotateY
 // needlessly forces CPU-only CI Chrome to rasterize every layer in 3D.
 return <AbsoluteFill style={{overflow:'hidden',transform:reframe===1?'scale(1.12) translateX(-2%)':undefined}}>{(['background','midground','foreground'] as const).map((key,i)=><Img key={key} src={staticFile(layers[key])} style={{position:'absolute',inset:-35,width:'calc(100% + 70px)',height:'calc(100% + 70px)',objectFit:'cover',transform:`translate(${t*(i+1)*14*direction}px,${t*(i+1)*4}px) scale(${1.03+(t+.5)*(.025+i*.008)})`}}/>)}<div style={{position:'absolute',inset:-100,transform:`translateX(${t*35}px)`,opacity:.1,background:'radial-gradient(ellipse at 20% 90%,#cfcec6,transparent 50%)'}}/><div style={{position:'absolute',inset:0,opacity:.09,background:'linear-gradient(115deg,transparent 35%,#efd8a7 46%,transparent 53%)',transform:`translateX(${t*18}px)`}}/>{Array.from({length:12},(_,i)=><div key={i} style={{position:'absolute',left:`${(i*73)%100}%`,top:`${(i*47+f*.04)%100}%`,width:2,height:2,borderRadius:2,background:'#edd8b7',opacity:.14}}/>)}</AbsoluteFill>;
}
