import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {read,json} from '../src/orchestration/io';
import {monthlyProduction,monthlyShortsAuthorized} from '../src/orchestration/monthly-production';
import {buildClips,previewPortraitLayout} from '../src/social/clips';
import {publishClips,ZernioClient} from '../src/social/publish';
async function main(){
 const action=z.enum(['preflight','layout-preview','build','youtube','tiktok','auto-youtube']).parse(process.env.SOCIAL_ACTION??'preflight');
 if(action==='preflight'){const client=new ZernioClient(process.env.ZERNIO_API_KEY??''),account=await client.account(),creator=await client.creator(account._id);console.log(JSON.stringify({platform:'tiktok',username:account.username,creator:creator.creator,privacyLevels:creator.privacyLevels,postingLimits:creator.postingLimits,published:false}));return;}
 const runId=z.string().regex(/^[A-Za-z0-9_-]+$/).parse(process.env.RUN_ID);
 if(action==='auto-youtube'){
  const policy=monthlyProduction.parse(await read('config/monthly-production.json'));
  if(!monthlyShortsAuthorized(policy,runId))throw Error('Episode has no active standing Shorts authorization');
  const path=`data/runs/${runId}/social/bundle.json`,sha=createHash('sha256').update(await readFile(path)).digest('hex');
  await json(`data/runs/${runId}/social/automatic-youtube-authorization.json`,{runId,bundleSha256:sha,authorization:'Owner-authorized unattended monthly queue',humanPreviewClaimed:false,at:new Date().toISOString()});
  console.log(JSON.stringify(await publishClips(runId,path,sha,'youtube')));return;
 }
 if(action==='layout-preview')console.log(JSON.stringify(await previewPortraitLayout(runId)));
 else if(action==='build')console.log(JSON.stringify(await buildClips(runId)));
 else console.log(JSON.stringify(await publishClips(runId,`data/runs/${runId}/social/bundle.json`,process.env.APPROVED_BUNDLE_SHA256??'',action)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(JSON.stringify({event:'social_delivery_failed',message:error instanceof Error?error.message:'Delivery failed'}));process.exitCode=1;});
