import React from 'react';
import {AbsoluteFill,Img,staticFile} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
export const Thumbnail:React.FC<Composition>=(props)=>{
 const variant=props.thumbnailVariant??'A',images=props.assets.filter(a=>a.kind==='image');
 const image=images[variant==='B'?Math.floor(images.length/2):variant==='C'?images.length-1:0];
 if(!image)throw new Error('Thumbnail requires an actual v4 AI illustration, never programmatic subjects');requireIllustratedArtwork(image);
 const title=props.thumbnailTitle??'A DAY BEGINS';if(title.split(/\\s+/).length>5)throw new Error('Thumbnail label exceeds five words');
 return <AbsoluteFill style={{background:'#f5edda',fontFamily:'Arial,sans-serif'}}><Img src={staticFile(image.path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/><div style={{position:'absolute',left:65,top:65,maxWidth:600,fontSize:96,fontWeight:900,lineHeight:1.05,color:'#302a25',textShadow:'0 2px 6px #f5edda'}}>{title}</div></AbsoluteFill>;
};
