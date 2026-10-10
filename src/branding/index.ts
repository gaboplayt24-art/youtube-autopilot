import {join} from 'node:path';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {Runner} from '../orchestration/runner';
import {loadConfig} from '../orchestration/config';
import {json,read,exec} from '../orchestration/io';
import {FreeFirstLLM} from '../providers/free';
import {CostLedger,withCosts,loadCostPolicy} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {VisualStyleEngine} from '../visuals/native-v4-2';
import {artworkIdea} from '../visuals/illustration-schema';
import {KLEIN_PRODUCTION_SIZE} from '../providers/cloudflare';

const context='Iron Age Judah, around 700 BCE; stone walls, mud brick, olive trees, clay lamps, plain wool and linen tunics.';
/** Channel identity artwork: FLUX draws the illustrated art in the locked style; HTML/CSS adds only the channel name. */
export const brandingIdeas=[
 artworkIdea.parse({id:'brand-logo-3',narration:'Channel avatar for a biblical history and curiosities channel.',historicalContext:'Iron Age Judah, around 700 BCE; plain wool mantle and head cloth, small clay oil lamp.',concept:'Close-up of one friendly mature bearded ancient scribe: head and shoulders fill the whole frame height, centered, plain wool head cloth, raised eyebrows and a warm curious smile, looking at the viewer, a small lit clay oil lamp held beside his cheek. Flat plain background. The drawing reaches every edge: no frame, border, panel or margin.',overlay:null,labelPlacement:'top',characterRoles:['bearded scribe']}),
 artworkIdea.parse({id:'brand-banner-2',narration:'Channel banner for a biblical history and curiosities channel.',historicalContext:context,concept:'Wide sunrise view of an ancient hillside city: stone walls, one gate and olive trees run along the bottom third only. The upper two thirds are open pale sky with no objects. One small mature scribe with a scroll and clay lamp stands at the far right edge. The drawing reaches every edge: no frame, border, panel or margin.',overlay:null,labelPlacement:'top',characterRoles:['scribe with a scroll']}),
];
async function screenshot(html:string,png:string,width:number,height:number){
 const chrome=process.env.CHROME_EXECUTABLE??'/usr/bin/google-chrome';
 await exec(chrome,['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',`--window-size=${width},${height}`,`--screenshot=${png}`,'file://'+html],{timeout:60000});
}
export async function createBranding(runId='branding-001'){
 const dir=join('data/runs',runId);await mkdir(dir,{recursive:true});
 const ledger=new CostLedger(await loadCostPolicy(),dir);await ledger.restore();const quota=new FreeQuotaLedger(dir);await quota.restore();
 return withQuota(quota,()=>withCosts(ledger,async()=>{const runner=new Runner(dir,undefined,runId);await runner.lock();try{
  const config=await loadConfig();const channel=await read('config/channel-profile.json') as {name:string;tagline?:string};
  const engine=new VisualStyleEngine(),llm=new FreeFirstLLM(),reference=process.env.STYLE_REFERENCE_PATH??'assets/references/style-v4.jpg';
  const sources:Record<string,string>={};
  for(const idea of brandingIdeas){const result=await engine.generate(idea,config.visualSystem,reference,join(dir,'sources'),runner,llm,KLEIN_PRODUCTION_SIZE.width,KLEIN_PRODUCTION_SIZE.height);if(!result.review.passed||!result.artwork)throw new Error('Branding artwork QA failed: '+idea.id+' evidence '+JSON.stringify({objectiveFailures:result.review.objectiveFailures,issues:result.review.issues,seriousAnatomyDefects:result.review.seriousAnatomyDefects??[]}));sources[idea.id]=result.source.path;}
  const abs=(p:string)=>join(process.cwd(),p);
  // Logo: uniform scale of the centred portrait into YouTube's 800x800 avatar; the face sits in the circle-safe middle.
  await writeFile(join(dir,'logo.html'),`<html><body style="margin:0;width:800px;height:800px;position:relative;overflow:hidden;background:#f5edda"><img src="file://${abs(sources['brand-logo-3'])}" style="width:800px;height:800px;object-fit:cover;object-position:50% 35%;transform:scale(1.35);transform-origin:50% 40%"/><div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 34px #b5532f,inset 0 0 0 44px #14100c"></div></body></html>`);
  await screenshot(abs(join(dir,'logo.html')),abs(join(dir,'logo.png')),800,800);
  // Banner: native 16:9 art uniformly upscaled to 2560x1440; the channel name stays inside the 1546x423 safe area for every device.
  const name=channel.name.replace(/[<>&"]/g,''),tagline=(channel.tagline??'').replace(/[<>&"]/g,'');
  await writeFile(join(dir,'banner.html'),`<html><body style="margin:0;width:2560px;height:1440px;position:relative;overflow:hidden;background:#f5edda"><img src="file://${abs(sources['brand-banner-2'])}" style="width:2560px;height:1440px;object-fit:cover"/><div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'Arial Black','Liberation Sans',Impact,sans-serif"><div style="font-size:150px;font-weight:900;line-height:1;text-transform:uppercase;color:#ffe23d;-webkit-text-stroke:12px #14100c;paint-order:stroke fill;text-shadow:8px 8px 0 #14100c,-8px 8px 0 #14100c,8px -8px 0 #14100c,-8px -8px 0 #14100c">${name}</div>${tagline?`<div style="margin-top:28px;font-size:56px;font-weight:900;color:#2b1d12;-webkit-text-stroke:10px #fff8e6;paint-order:stroke fill">${tagline}</div>`:''}</div></body></html>`);
  await screenshot(abs(join(dir,'banner.html')),abs(join(dir,'banner.png')),2560,1440);
  for(const [path,w,h] of [[join(dir,'logo.png'),800,800],[join(dir,'banner.png'),2560,1440]] as const){const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path])).stdout).streams[0];if(probe.width!==w||probe.height!==h)throw new Error(`Branding output ${path} is ${probe.width}x${probe.height}, expected ${w}x${h}`);}
  await copyFile('config/channel-profile.json',join(dir,'channel-profile.json'));
  const summary={logo:join(dir,'logo.png'),banner:join(dir,'banner.png'),sources,channel,paidApiCostUsd:0,published:false,nextAction:'Owner reviews logo, banner, name and description, then uploads them manually in YouTube Studio'};await json(join(dir,'branding-summary.json'),summary);return summary;
 }finally{await runner.unlock();await ledger.report();await quota.report();}}));
}
