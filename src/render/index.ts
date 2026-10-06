import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition,renderStill} from '@remotion/renderer';
import type {Composition} from '../orchestration/schemas';
import {resolve} from 'node:path';
export async function renderVideo(props:Composition,path:string){const serveUrl=await bundle({entryPoint:resolve('remotion/Root.tsx'),publicDir:resolve('public')});const browserExecutable=process.env.CHROME_EXECUTABLE;const composition=await selectComposition({serveUrl,id:'Explainer',inputProps:props,browserExecutable});await renderMedia({serveUrl,composition,codec:'h264',outputLocation:path,inputProps:props,browserExecutable,concurrency:2});return {serveUrl,composition};}
export async function renderThumbnail(props:Composition,path:string){const serveUrl=await bundle({entryPoint:resolve('remotion/Root.tsx'),publicDir:resolve('public')});const browserExecutable=process.env.CHROME_EXECUTABLE;const composition=await selectComposition({serveUrl,id:'Explainer',inputProps:props,browserExecutable});await renderStill({serveUrl,composition,output:path,imageFormat:'png',inputProps:props,frame:0,browserExecutable});}
