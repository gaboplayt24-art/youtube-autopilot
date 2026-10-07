import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import {doodleGlyph,doodlePalette as p} from '../../src/visuals/doodle-art';
export function DoodleThumbnail(props:Composition){
 const shot=props.shots.find(s=>s.visualIdea),idea=shot?.visualIdea;
 const variant=props.thumbnailVariant??'A',i=variant==='A'?0:variant==='B'?1:2;
 const node=idea?.nodes[Math.min(i,idea.nodes.length-1)];const words=(props.thumbnailTitle??'A MERCHANT’S DAY').split(/\s+/).slice(0,5);
 return <AbsoluteFill style={{background:p.paper,fontFamily:'Arial,sans-serif',color:p.ink}}><div style={{position:'absolute',left:75,top:140,width:590,fontSize:92,fontWeight:900,lineHeight:1.05}}>{words.map((w,index)=><span key={index} style={{color:p.ink}}>{w} </span>)}</div><svg width="1280" height="720" viewBox="0 0 1280 720" style={{position:'absolute',inset:0}}><circle cx="970" cy="350" r="195" fill={p.sand}/><g transform="translate(965 350) scale(2.1)" stroke={p.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:doodleGlyph(node?.icon??'person',node?.pose)}}/><path d="M675 380 Q720 330 775 355 M745 320 L780 355 L745 385" stroke={p.terracotta} strokeWidth={14} strokeLinecap="round" fill="none"/></svg></AbsoluteFill>;
}
