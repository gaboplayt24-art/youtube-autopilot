import React,{useEffect,useState} from 'react';
import {AbsoluteFill,Img,continueRender,delayRender,staticFile} from 'remotion';
import type {Composition} from '../../src/orchestration/schemas';
import {requireIllustratedArtwork} from '../../src/visuals/illustration-schema';
const DISPLAY_FONT='"Anton","Arial Black","Liberation Sans",Impact,sans-serif';
// Anton (SIL OFL) is fetched into public/fonts by the workflow; without it the render falls back to Arial Black.
function useDisplayFont(){
 const [handle]=useState(()=>delayRender('thumbnail display font'));
 useEffect(()=>{const font=new FontFace('Anton',`url(${staticFile('fonts/Anton-Regular.ttf')})`);font.load().then(f=>{document.fonts.add(f);continueRender(handle);}).catch(()=>continueRender(handle));},[handle]);
}
/** Splits the label into two stacked lines; the last line is the highlighted payoff word(s). */
export function thumbnailLines(title:string){const words=title.trim().toUpperCase().split(/\s+/).filter(Boolean);if(words.length<=1)return {top:'',accent:words[0]??''};const cut=words.length===2?1:words.length-2;return {top:words.slice(0,cut).join(' '),accent:words.slice(cut).join(' ')};}
const stroke=(px:number)=>({WebkitTextStroke:`${px}px #0d0a07`,paintOrder:'stroke fill' as const,textShadow:'0 14px 0 #0d0a07, 0 22px 30px rgba(0,0,0,.55)'});
export const Thumbnail:React.FC<Composition>=(props)=>{
 useDisplayFont();
 const variant=props.thumbnailVariant??'A',images=props.assets.filter(a=>a.kind==='image');
 const image=images[variant==='B'?Math.floor(images.length/2):variant==='C'?images.length-1:0];
 if(!image)throw new Error('Thumbnail requires an actual v4 AI illustration, never programmatic subjects');requireIllustratedArtwork(image);
 const title=props.thumbnailTitle??'A DAY BEGINS';if(title.trim().split(/\s+/).filter(Boolean).length>4)throw new Error('Thumbnail label exceeds four words');
 const {top,accent}=thumbnailLines(title);
 return <AbsoluteFill style={{background:'#0d0a07',fontFamily:DISPLAY_FONT}}>
  <Img src={staticFile(image.path)} style={{width:'100%',height:'100%',objectFit:'cover',filter:'saturate(1.25) contrast(1.12)'}}/>
  {/* Soft rim glow behind the focal face (right) separates it from the backdrop; the corner vignette keeps the eye inside the frame. */}
  <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 72% 40%, rgba(255,214,140,.38) 0%, rgba(255,214,140,0) 32%)',mixBlendMode:'screen'}}/>
  <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 65% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.4) 100%)'}}/>
  {title.trim()?<div style={{position:'absolute',left:110,top:150,width:'54%',transform:'rotate(-3deg)',transformOrigin:'left top',lineHeight:.92,textTransform:'uppercase',letterSpacing:2}}>
   {top?<div style={{fontSize:accent.length+top.length<=12?300:250,color:'#ffffff',...stroke(22)}}>{top}</div>:null}
   <div style={{display:'inline-block',marginTop:24,fontSize:accent.length<=8?380:300,color:'#ffd21f',...stroke(26)}}>{accent}</div>
  </div>:null}
 </AbsoluteFill>;
};
