import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Thumbnail} from './compositions/Thumbnail';
import {Explainer} from './compositions/Explainer';
import {Short} from './compositions/Short';
import type {Composition as Props} from '../src/orchestration/schemas';
const defaults:Props={fps:30,width:1920,height:1080,durationInFrames:30,scenes:[],cues:[],shots:[],assets:[]};
const Root:React.FC=()=> <><Composition id="Explainer" component={Explainer} width={1920} height={1080} fps={30} durationInFrames={30} defaultProps={defaults} calculateMetadata={({props})=>({durationInFrames:props.durationInFrames,fps:props.fps,width:props.width,height:props.height})}/><Composition id="Short" component={Short} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={defaults} calculateMetadata={({props})=>({durationInFrames:props.durationInFrames,fps:props.fps,width:1080,height:1920})}/><Composition id="Thumbnail" component={Thumbnail} width={3840} height={2160} fps={30} durationInFrames={1} defaultProps={defaults}/></>;
registerRoot(Root);
