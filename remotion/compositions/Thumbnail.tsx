import React from 'react';
import {AbsoluteFill,Img,staticFile} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
export const Thumbnail:React.FC<Composition>=(props)=>{
 const variant=props.thumbnailVariant??'A',images=props.assets.filter(a=>a.kind==='image');
 const image=images[variant==='B'?Math.floor(images.length/2):variant==='C'?images.length-1:0];
 if(!image)throw new Error('Thumbnail requires an actual v4 AI illustration, never programmatic subjects');requireIllustratedArtwork(image);
 const title=props.thumbnailTitle??'A DAY BEGINS';if(title.trim().split(/\s+/).filter(Boolean).length>4)throw new Error('Thumbnail label exceeds four words');
 return <AbsoluteFill style={{background:'#f5edda',fontFamily:'Arial,sans-serif'}}><Img src={staticFile(image.path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>{title.trim()?<div style={{position:'absolute',left:90,right:90,top:50,textAlign:'center',fontFamily:'"Arial Black","Liberation Sans",Impact,sans-serif',fontSize:title.trim().split(/\s+/).filter(Boolean).length<=2?360:280,fontWeight:900,lineHeight:1,letterSpacing:4,textTransform:'uppercase',color:'#ffe23d',WebkitTextStroke:'20px #14100c',paintOrder:'stroke fill',textShadow:'0 0 0 #14100c, 14px 14px 0 #14100c, -14px 14px 0 #14100c, 14px -14px 0 #14100c, -14px -14px 0 #14100c, 0 18px 24px rgba(0,0,0,.45)'}}>{title}</div>:null}</AbsoluteFill>;
};
