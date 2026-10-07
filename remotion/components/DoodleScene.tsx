import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';
import type {VisualIdea} from '../../src/visuals/thinking-schema';
import {doodleSVG} from '../../src/visuals/doodle-art';
export function DoodleScene({idea,frames}:{idea:VisualIdea;frames:number}){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const reveal=Math.min(1,frame/(fps*1.1));const progress=Math.min(1,frame/Math.max(1,frames));
 return <AbsoluteFill style={{transform:`scale(${1+progress*.015}) translateX(${progress*-8}px)`,transformOrigin:'50% 45%'}} dangerouslySetInnerHTML={{__html:doodleSVG(idea,reveal)}}/>;
}
