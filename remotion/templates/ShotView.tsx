import React from 'react';
import {IllustratedScene} from '../components/IllustratedScene';
import type {Shot,MediaAsset} from '../../src/editor/schemas';
export function ShotView({shot,asset,frames}:{shot:Shot;asset:MediaAsset;frames:number;index:number}){
 return <IllustratedScene shot={shot} asset={asset} frames={frames}/>;
}
