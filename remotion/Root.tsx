import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Explainer} from './compositions/Explainer';
import type {Composition as Props} from '../src/orchestration/schemas';
const defaults:Props={fps:30,width:1280,height:720,durationInFrames:30,scenes:[],cues:[]};
const Root:React.FC=()=> <Composition id="Explainer" component={Explainer} width={1280} height={720} fps={30} durationInFrames={30} defaultProps={defaults} calculateMetadata={({props})=>({durationInFrames:props.durationInFrames,fps:props.fps,width:props.width,height:props.height})}/>;
registerRoot(Root);
