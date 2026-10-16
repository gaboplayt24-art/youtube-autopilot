// Renders a short owner-review excerpt of an already QA-passed run with the dynamic edit. Reuses the run's
// approved illustrations, captions and mixed narration; only the edit layer and its sound effects are new.
import {readFile,mkdir,copyFile,writeFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser,renderMedia,selectComposition} from '@remotion/renderer';
import {composition as schema} from '../src/orchestration/schemas';
import {buildDynamicEdit} from '../src/editor/dynamic-edit-stage';
import {writeSfxTrack} from '../src/audio/sfx-library';
import {loadAudioConfig} from '../src/audio/qa';
import {browserOptions,withBrowser} from '../src/render/browser';

const arg=(name:string,fallback?:string)=>{const i=process.argv.indexOf(`--${name}`);const value=i>0?process.argv[i+1]:fallback;if(value===undefined)throw new Error(`--${name} required`);return value;};
const runDir=resolve(arg('run-dir')),runId=arg('run-id'),from=Number(arg('from','0')),to=Number(arg('to','36')),out=resolve(arg('out'));
const read=async(p:string)=>JSON.parse(await readFile(join(runDir,p),'utf8'));
const props=schema.parse(await read('composition.json'));
const script=await read('final-script.json') as {scenes:{id:string;claims?:{text:string}[]}[]};
const visuals=await read('visuals.json') as {assets:{shotId:string;path:string}[]};
const words=props.cues.flatMap(c=>c.words??[]);
const scenes=props.scenes.map(s=>({id:s.id,start:s.from/props.fps,claims:script.scenes.find(x=>x.id===s.id)?.claims}));
const edit=await buildDynamicEdit({runId,shots:props.shots,words,scenes,images:visuals.assets.map(a=>({shotId:a.shotId,path:join(runDir,a.path.replace(`data/runs/${runId}/`,''))})),layersDir:join(runDir,'assets/layers'),layerShots:new Set(props.shots.filter(s=>s.start<to).map(s=>s.id))});
await writeFile(out.replace(/\.mp4$/,'-edit.json'),JSON.stringify(edit,null,1));

const pub=resolve('public',runId);await mkdir(pub,{recursive:true});
await cp(join(runDir,'assets/layers'),join(pub,'layers'),{recursive:true});
for(const a of visuals.assets)await copyFile(join(runDir,a.path.replace(`data/runs/${runId}/`,'')),join(pub,`${a.shotId}.png`));
const seconds=props.durationInFrames/props.fps,config=await loadAudioConfig();
const sfx=join(runDir,'sfx-dynamic.wav');await writeSfxTrack(edit.sfx,seconds,sfx);
// Preview only: lay the effects stem over the QA-passed mix. Production re-mixes and re-measures every stem.
execFileSync('ffmpeg',['-y','-v','error','-i',join(runDir,'assets/mixed.wav'),'-i',sfx,'-filter_complex',`[1:a]volume=${config.sfxDb}dB[s];[0:a][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[m]`,'-map','[m]','-ar','48000',join(pub,'mixed-dynamic.wav')]);
const input={...props,edit,audioMixPath:`${runId}/mixed-dynamic.wav`};
const serveUrl=await bundle({entryPoint:resolve('remotion/Root.tsx'),publicDir:resolve('public')});
const options=browserOptions(process.env.CHROME_EXECUTABLE||undefined);
await withBrowser(()=>openBrowser('chrome',options),async browser=>{
 const common={serveUrl,inputProps:input,puppeteerInstance:browser,...options,timeoutInMilliseconds:60000};
 const composition=await selectComposition({...common,id:'Explainer'});
 await renderMedia({...common,composition,codec:'h264',audioCodec:'aac',outputLocation:out,concurrency:4,frameRange:[Math.round(from*props.fps),Math.round(to*props.fps)-1],onProgress:({progress})=>{if(Math.round(progress*100)%10===0)process.stdout.write(`${Math.round(progress*100)}% `);}});
});
console.log(JSON.stringify({out,beats:edit.beats.length,pops:edit.pops.length,cards:edit.cards.length,sfx:edit.sfx.length}));
