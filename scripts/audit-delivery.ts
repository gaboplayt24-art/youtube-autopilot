import {readFile,appendFile} from 'node:fs/promises';
import {google} from 'googleapis';
import {auth} from '../src/youtube';
import {ZernioClient} from '../src/social/publish';
import {auditDelivery,deliveryTargets} from '../src/social/delivery-audit';

async function main(){
 const plan=deliveryTargets.parse(JSON.parse(await readFile('data/metadata/bible-angels-001-delivery-targets.json','utf8')));
 const youtube=google.youtube({version:'v3',auth:auth()}),zernio=new ZernioClient(process.env.ZERNIO_API_KEY??'');
 const report=await auditDelivery(plan,async ids=>(await youtube.videos.list({id:ids,part:['snippet','status','statistics'],maxResults:50})).data.items??[],id=>zernio.api('/posts/'+encodeURIComponent(id)));
 console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Existing episode delivery — read only\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
 if(!report.healthy)process.exitCode=2;
}
main().catch(()=>{console.error('Delivery audit failed; no content was changed and no credentials were logged.');process.exitCode=1;});
