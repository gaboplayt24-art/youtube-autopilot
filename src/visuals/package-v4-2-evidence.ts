import {parseArgs} from 'node:util';
import {join,basename} from 'node:path';
import {z} from 'zod';
import {read,json,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {CostLedger,loadCostPolicy} from '../cost';
import {nativeSource} from './native-v4-2';
import {illustrationContactSheet} from './style-contact-sheet-v4';
import {referenceAnalysis} from './illustration-schema';
// Evidence-only: no provider construction, Secrets or inference calls.
export async function packageV42Evidence(dir:string,sourceRunId:string){
 if(!/^\d+$/.test(sourceRunId))throw new Error('Numeric source Actions run required');
 const sources=z.array(nativeSource.and(z.object({file:z.string().regex(/^source-0[1-4]\.png$/)}))).length(4).parse(await read(join(dir,'source-dimensions-v4.2.json')));
 if(new Set(sources.map(s=>s.file)).size!==4)throw new Error('Four distinct original sources required');
 const analysis=referenceAnalysis.parse(await read(join(dir,'style-reference-analysis-v4.2.json')));if(analysis.referenceSha256!==await fileDigest('assets/references/style-v4.jpg'))throw new Error('Original reference changed; cannot relabel evidence');
 for(const s of sources){const path=join(dir,s.file),original=join(dir,'native-sources',basename(s.path));if(await fileDigest(path)!==s.sha256||await fileDigest(original)!==s.sha256)throw new Error('Raw original source integrity mismatch');const stream=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path])).stdout).streams[0];if(stream.width!==1536||stream.height!==864||s.width!==1536||s.height!==864)throw new Error('Audition sources must remain native 1536x864');}
 const costs=new CostLedger(await loadCostPolicy(),dir);await costs.restore();if(costs.entries.some(e=>e.classification!=='FREE'||e.reservedUsd!==0))throw new Error('Unexpected paid evidence; never rewrite paid entries as free');await costs.report();
 const qa=z.object({passed:z.boolean()}).passthrough().parse(await read(join(dir,'first-four-reference-style-QA-v4.2.json')));await json(join(dir,'reference-style-QA-v4.2.json'),qa);
 await illustrationContactSheet(sources.map(s=>({id:s.file.replace('.png',''),path:join(dir,s.file)})),join(dir,'STYLE-PREVIEW-v4.2.jpg'),join(dir,'native-preview-compact'),2,true);
 await json(join(dir,'evidence-packaging-v4.2.json'),{sourceInferenceWorkflow:`https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/${sourceRunId}`,newInferenceCalls:0,rawSourcesUnchanged:true,originalQAPassed:qa.passed,humanApprovalRequired:true,paidApiCostUsd:0,videoGenerated:false,note:'Only contact-sheet layout and erroneous paidAssets counter corrected. Original source hashes, generation evidence and QA decisions retained.'});
}
const {values}=parseArgs({options:{dir:{type:'string'},'source-run-id':{type:'string'}}});if(!values.dir||!values['source-run-id'])throw new Error('--dir and --source-run-id are required');packageV42Evidence(values.dir,values['source-run-id']).catch(e=>{console.error(e.message);process.exitCode=1;});
