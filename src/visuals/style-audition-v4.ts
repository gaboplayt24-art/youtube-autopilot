import {parseArgs} from 'node:util';
import {mkdir,access,copyFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Runner} from '../orchestration/runner';
import {read,json} from '../orchestration/io';
import {fileDigest,digest} from '../orchestration/integrity';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota,QuotaPause} from '../quota';
import {GeminiProvider} from '../providers/free';
import {CloudflareWorkersAIImageProvider,FLUX_MODEL} from '../providers/cloudflare';
import {illustratedStyleLock,referenceAnalysis,styleReview,type ArtworkIdea} from './illustration-schema';
import {analyzeStyleReference,deriveStyleLock,reviewIllustration} from './style-reference-v4';
import {acceptedIllustration,generateIllustration,inspectIllustrationReuse} from './illustrated-assets-v4';
import {styleAuditionScenesV4} from './style-audition-scenes-v4';
import {illustrationContactSheet} from './style-contact-sheet-v4';
import {firstFourStyleGate} from './preview-gate-v4';
import {renderPreview} from '../render';
import {composition} from '../orchestration/schemas';
import {profile} from '../editor/schemas';

export async function runStyleAuditionV4(options:{runId:string;reference:string;validateOnly?:boolean}){
 if(!/^style-v4-[A-Za-z0-9_-]+$/.test(options.runId))throw new Error('A fresh style-v4-... run ID is required');
 const dir=join('data/runs',options.runId),runner=new Runner(dir),costs=new CostLedger(await loadCostPolicy(),dir),quota=new FreeQuotaLedger(dir);await runner.lock();await costs.restore();await quota.restore();const start=performance.now(),initialEvents=quota.events.length;
 let state='failed',referenceHash:string|null=null;
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
  const template=illustratedStyleLock.parse(await read('config/style-lock-v4.json'));
  for(const [file,value] of [['style-lock-v4.json',template],['style-reference-analysis-v4.json',await read('config/style-reference-analysis-v4.json')]] as const){try{await access(join(dir,file));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await json(join(dir,file),value);}}
  if(options.validateOnly){await json(join(dir,'validation-only.json'),{codeValidationOnly:true,multimodalAnalysisExecuted:false,fluxGenerationCount:0,styleApproved:false,videoGenerated:false,note:'Not a style audition; actual positive reference bytes are still required.'});state='validation_only';return;}
  try{await access(options.reference);}catch{await json(join(dir,'reference-required.json'),{referencePath:options.reference,reason:'Attach the positive screenshot as a downloadable PNG/JPG, or supply its HTTPS image URL / repository file to the manual workflow. Inline chat image bytes are not available to GitHub Actions.',generationCount:0});throw new Error('Downloadable positive reference missing: no Gemini style analysis or FLUX spending performed');}
  referenceHash=await fileDigest(options.reference);
  const fingerprint=digest({referenceHash,template,scenes:styleAuditionScenesV4});const manifestFile=join(dir,'audition-manifest.json');let previous;try{previous=await read(manifestFile);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(previous&&previous.fingerprint!==fingerprint)throw new Error('Reference/style/concepts changed; use a new style-v4 run ID, never overwrite old evidence');
  if(!previous)await json(manifestFile,{fingerprint,referenceHash,createdAt:new Date().toISOString(),styleVersion:template.version,videoAuthorized:false});
  if(!process.env.GEMINI_API_KEY||process.env.GEMINI_FREE_TIER_CONFIRMED!=='true')throw new Error('Run real style analysis only in GitHub Actions with the existing Gemini Secret and confirmed free tier');
  const gemini=new GeminiProvider();await gemini.discover();
  const analysis=await runner.stage('reference-analysis-v4',referenceAnalysis,()=>analyzeStyleReference(options.reference,gemini),async a=>{if(a.referenceSha256!==referenceHash)throw new Error('Reference analysis checksum mismatch');});await json(join(dir,'style-reference-analysis-v4.json'),analysis);
  const style=deriveStyleLock(template,analysis);await json(join(dir,'style-lock-v4.json'),style);
  const image=new CloudflareWorkersAIImageProvider(),accepted=[];
  await firstFourStyleGate(async index=>{const idea=styleAuditionScenesV4[index];return runner.stage('accepted-'+idea.id,acceptedIllustration,()=>generateIllustration(idea,{...style,maxRegenerationsPerScene:0},options.reference,join(dir,'illustrations'),runner,image,gemini),async a=>{if(a.source.sha256!==await fileDigest(a.source.path)||a.framedSha256!==await fileDigest(a.framedPath)||a.artwork.referenceSha256!==referenceHash||!a.review.passed)throw new Error('Preview integrity/reference QA failure');});},async samples=>{
   for(const [index,sample]of samples.entries())await copyFile(sample.source.path,join(dir,`source-${String(index+1).padStart(2,'0')}.png`));
   await illustrationContactSheet(samples.map(s=>({id:s.ideaId,path:s.source.path})),join(dir,'STYLE-PREVIEW-v4.jpg'),join(dir,'preview-tiles'),2);
   const report={referenceSha256:referenceHash,method:'Actual Gemini comparison against positive reference, first four raw FLUX illustrations and their delivery crops',completedScenes:4,targetScenes:12,passed:samples.every(s=>s.review.passed),humanApprovalRequired:true,remainingEightAuthorized:samples.every(s=>s.review.passed),reviews:samples.map(s=>({id:s.ideaId,attempt:s.attempt,...s.review}))};
   await json(join(dir,'first-four-reference-style-QA-v4.json'),report);await json(join(dir,'reference-style-QA-v4.json'),report);
  });
  for(const idea of styleAuditionScenesV4){const result=await runner.stage('accepted-'+idea.id,acceptedIllustration,()=>generateIllustration(idea,style,options.reference,join(dir,'illustrations'),runner,image,gemini),async a=>{if(a.source.sha256!==await fileDigest(a.source.path)||a.framedSha256!==await fileDigest(a.framedPath)||a.artwork.referenceSha256!==referenceHash||!a.review.passed)throw new Error('Accepted illustration integrity/reference QA failure');});accepted.push(result);await json(join(dir,'reference-style-QA-v4.json'),{referenceSha256:referenceHash,method:'Actual Gemini comparison: reference, FLUX source, 16:9 delivery',completedScenes:accepted.length,targetScenes:12,passed:false,humanApprovalRequired:true,reviews:accepted.map(a=>({id:a.ideaId,attempt:a.attempt,...a.review}))});}
  const reuse=inspectIllustrationReuse(accepted.map(a=>({id:a.ideaId,sha256:a.source.sha256})),1);if(!reuse.passed||reuse.uniqueSources!==12)throw new Error('The style audition requires 12 unique actual FLUX sources');
  for(const [index,art]of accepted.entries())await copyFile(art.source.path,join(dir,`source-${String(index+1).padStart(2,'0')}.png`));
  await illustrationContactSheet(accepted.map(a=>({id:a.ideaId,path:a.source.path})),join(dir,'STYLE-TEST-CONTACT-SHEET-v4.jpg'),join(dir,'contact-tiles'));
  const pub=join('public',options.runId);await mkdir(pub,{recursive:true});const presentation=[];
  for(const index of [0,3,6,8]){const art=accepted[index],idea:ArtworkIdea=styleAuditionScenesV4[index];await copyFile(art.framedPath,join(pub,idea.id+'.png'));
   const asset={shotId:idea.id,path:options.runId+'/'+idea.id+'.png',sha256:art.framedSha256,kind:'image' as const,provider:'cloudflare-flux-free',sourceSha256:art.source.sha256,license:'Original AI illustration; FLUX Apache-2.0 and Cloudflare/BFL terms apply',sourceUrl:null,estimatedCost:0,intent:idea.concept,fallbacks:[],artwork:art.artwork};
   const props=composition.parse({width:1920,height:1080,fps:30,durationInFrames:90,scenes:[],cues:[],shots:[{id:idea.id,sceneId:idea.id,start:0,end:3,narration:idea.narration,visualIntent:idea.concept,shotType:'generated-image',motion:index%2?'pan-right':'slow-push-in',assetPrompt:art.source.prompt,overlay:idea.overlay,illustrationIdea:idea,overlayArrow:index===0?[.22,.24,.45,.47]:undefined,keywords:[],highImpact:false,transition:'cut'}],assets:[asset],visualProfile:profile.parse(await read('config/visual-profiles/history.json'))});
   const frame=join(dir,idea.id+'-editorial.png');await renderPreview(props,frame,22);
   const qa=await runner.stage('presentation-'+idea.id+'-QA',styleReview,()=>reviewIllustration(options.reference,art.source.path,frame,idea,style,gemini,idea.overlay??undefined));if(!qa.passed)throw new Error('Illustrated editorial presentation failed actual-reference QA; no video');presentation.push({id:idea.id,path:frame});
  }
  await illustrationContactSheet(presentation,join(dir,'STYLE-TEST-SCENES-v4.jpg'),join(dir,'presentation-tiles'),2);
  await json(join(dir,'reference-style-QA-v4.json'),{referenceSha256:referenceHash,method:'Actual Gemini reference comparisons, not written-style-only QA',completedScenes:12,targetScenes:12,passed:true,humanApprovalRequired:true,productionApproved:false,reviews:accepted.map(a=>({id:a.ideaId,attempt:a.attempt,...a.review})),editorialPresentations:presentation});
  state='complete_awaiting_human_style_approval';
 }));}catch(e){if(e instanceof QuotaPause)state='paused_quota';throw e;}finally{
  await costs.report();await quota.report();const newEvents=quota.events.slice(initialEvents).filter(e=>e.provider==='cloudflare'&&e.model===FLUX_MODEL);const files=await readdir(dir);const acceptedCount=files.filter(f=>/^accepted-\d+.*\.json$/.test(f)&&!f.endsWith('.integrity.json')).length;const failedReviews=[];for(const file of files.filter(f=>/-reference-QA\.json$/.test(f))){const review=await read(join(dir,file));if(!review.passed)failedReviews.push(file);}
  await json(join(dir,'audition-summary-v4.json'),{state,referenceSha256:referenceHash,acceptedIllustrations:acceptedCount,fluxGenerationCountThisExecution:newEvents.filter(e=>e.state==='completed').reduce((n,e)=>n+e.images,0),cloudflareRequestsThisExecution:newEvents.length,cloudflareReservedNeuronsThisExecution:newEvents.reduce((n,e)=>n+e.reservedNeurons,0),cloudflareActualNeurons:null,quotaNote:'Reservations are conservative; vendor/account measured consumption is unavailable.',paidCostUsd:0,geminiModelsUsedThisExecution:[...new Set(quota.events.slice(initialEvents).filter(e=>e.provider==='gemini'&&e.state==='completed').map(e=>e.model))],firstAttemptPassCount:(await Promise.all(files.filter(f=>/-attempt-0-reference-QA\.json$/.test(f)).map(f=>read(join(dir,f))))).filter(r=>r.passed).length,styleFailureReports:failedReviews,regenerationStageCount:files.filter(f=>/^illustration-.*-attempt-[12]\.json$/.test(f)).length,processRuntimeSeconds:(performance.now()-start)/1000,githubRunUrl:process.env.GITHUB_REPOSITORY&&process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,videoGenerated:false,voiceGenerated:false,autoPublish:false,humanApprovalRequired:true});await runner.unlock();
 }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){const {values}=parseArgs({options:{'run-id':{type:'string',default:'style-v4-001'},reference:{type:'string',default:'assets/references/style-v4.png'},'validate-only':{type:'boolean',default:false}}});runStyleAuditionV4({runId:values['run-id']!,reference:values.reference!,validateOnly:values['validate-only']}).catch(e=>{console.error(JSON.stringify({event:'style_audition_v4_failed',message:e.message}));process.exitCode=1;});}
