import {DepthParallax} from '../components/DepthParallax';
import {DoodleScene} from '../components/DoodleScene';
import React from 'react';
import {AbsoluteFill,Img,OffthreadVideo,staticFile} from 'remotion';
import type {Shot,MediaAsset} from '../../src/editor/schemas';
import {SlowZoom,PanLeft,PanRight,PullOut,Parallax,CameraShakeSubtle,BlurTransition,LightLeak,GradientOverlay,Vignette} from '../components/Motion';
import {MapPath,Timeline,ChartAnimation,DocumentZoom,HeadlineCard,QuoteCard,Diagram,KineticText,IconScene} from '../components/Graphics';
export function ShotView({shot,asset,frames,index}:{shot:Shot;asset:MediaAsset;frames:number;index:number}){
 if(shot.visualIdea)return <DoodleScene idea={shot.visualIdea} frames={frames}/>;
 const Camera={'slow-push-in':SlowZoom,'pan-left':PanLeft,'pan-right':PanRight,'pull-out':PullOut,parallax:Parallax,'subtle-shake':CameraShakeSubtle}[shot.motion];
 const media=asset.kind==='video'?<OffthreadVideo src={staticFile(asset.path)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Img src={staticFile(asset.path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>;
 const words=shot.overlay??shot.narration.split(/\s+/).slice(0,4).join(' ');const graphics=asset.provider==='kinetic-text'?<KineticText text={words}/>:shot.shotType==='map'?<MapPath labels={shot.labels}/>:shot.shotType==='chart'?<ChartAnimation data={shot.data} title={words} labels={shot.labels}/>:shot.shotType==='timeline'?<Timeline labels={shot.labels} title={words}/>:shot.shotType==='document'?<DocumentZoom text={words}/>:shot.shotType==='headline'?<HeadlineCard text={words}/>:shot.shotType==='quote'?<QuoteCard text={words}/>:shot.shotType==='diagram'?<Diagram labels={shot.labels} title={words}/>:shot.shotType==='kinetic-text'?<KineticText text={words}/>:shot.shotType==='icon-scene'?<IconScene labels={shot.labels}/>:null;
 const content=<AbsoluteFill><Camera duration={frames}>{asset.depthLayers?<DepthParallax asset={asset} frames={frames} reframe={shot.editorialReframe??0} direction={index%2===0?1:-1}/>:media}</Camera><GradientOverlay/>{graphics}<Vignette/><div style={{position:'absolute',top:65,left:90,fontSize:23,letterSpacing:5,color:'#e9d8baaa'}}>FIELD NOTES <span style={{color:'#efbc74'}}> / {String(index+1).padStart(2,'0')}</span></div>{!graphics&&shot.overlay&&<div style={{position:'absolute',left:125,top:180,fontSize:90,lineHeight:1.04,fontWeight:800,maxWidth:1000,color:'#fff0ce'}}>{shot.overlay}</div>}{shot.transition==='light-leak'&&<LightLeak/>}</AbsoluteFill>;
 return shot.transition==='blur'?<BlurTransition>{content}</BlurTransition>:content;
}
