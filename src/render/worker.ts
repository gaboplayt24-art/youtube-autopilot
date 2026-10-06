import {bundle} from '@remotion/bundler';
import {openBrowser,renderMedia,selectComposition,renderStill} from '@remotion/renderer';
import {resolve} from 'node:path';
import {composition as schema} from '../orchestration/schemas';
import {z} from 'zod';
import {browserOptions,withBrowser} from './browser';
const request=z.object({kind:z.enum(['video','thumbnail','preview']),props:schema,path:z.string().min(1),frame:z.number().int().nonnegative().default(0)});
async function execute(input:unknown){
 const {kind,props,path,frame}=request.parse(input);
 const serveUrl=await bundle({entryPoint:resolve('remotion/Root.tsx'),publicDir:resolve('public')});
 const browserExecutable=process.env.CHROME_EXECUTABLE||undefined;
 // Full Chrome must use --headless=new, not the old headless-shell launch flags.
 const options=browserOptions(browserExecutable);
 await withBrowser(()=>openBrowser('chrome',options),async browser=>{
  const common={serveUrl,inputProps:props,puppeteerInstance:browser,...options,timeoutInMilliseconds:30000};
  const composition=await selectComposition({...common,id:kind==='thumbnail'?'Thumbnail':'Explainer'});
  let lastProgress=-300;
  if(kind==='video')await renderMedia({...common,composition,codec:'h264',audioCodec:'aac',outputLocation:path,concurrency:2,onProgress:({renderedFrames})=>{if(renderedFrames-lastProgress>=300){lastProgress=renderedFrames;console.log(JSON.stringify({event:'render_progress',renderedFrames,totalFrames:composition.durationInFrames}));}}});
  else await renderStill({...common,composition,output:path,imageFormat:'png',frame});
 });
}
process.once('message',input=>{
 void execute(input).then(()=>complete({ok:true},0),error=>complete({ok:false,error:error instanceof Error?error.message:'Render failed'},1));
});
function complete(message:{ok:boolean;error?:string},code:number){
 // Explicit exit also invokes Remotion's registered browser kill handlers after launch failures.
 if(process.send)process.send(message,()=>process.exit(code));else process.exit(code);
}
