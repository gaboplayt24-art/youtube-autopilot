import {z} from 'zod';
import {join} from 'node:path';
import {copyFile} from 'node:fs/promises';
import {json,read,duration,exec} from './io';
import type {Script} from './schemas';
import type {ShotPlan,MediaAsset} from '../editor/schemas';
import type {LLMProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
const titleReport=z.object({candidates:z.array(z.object({title:z.string().min(8).max(100),clarity:z.number().min(0).max(100),curiosity:z.number().min(0).max(100),specificity:z.number().min(0).max(100),historicalTone:z.number().min(0).max(100),thumbnailSynergy:z.number().min(0).max(100),rationale:z.string().min(15)})).length(5)}).refine(v=>new Set(v.candidates.map(c=>c.title.toLowerCase())).size===5,'Five distinct original titles required');
export async function finalizeProductionTest(dir:string,script:Script,shots:ShotPlan,visuals:{assets:MediaAsset[]},audio:{path:string;duration:number;events:{time:number;type:string}[];provenance:string;sfxDb:number},audioReport:unknown,qa:unknown,llm:LLMProvider,seconds:number){
 const plan=await read(join(dir,'packaging-before-production.json'));
 const ranked=await validatedJSON(llm,`Return five distinct original title candidates grounded in the FINAL script and three own thumbnail concepts. Include approved script title and four alternatives. Score each clarity,curiosity,specificity,historicalTone,thumbnailSynergy 0–100, plus rationale. These are SUBJECTIVE editorial assessments, NEVER CTR/view predictions. No stronger claim than script evidence or copied competitor titles. Return {candidates:[{title,clarity,curiosity,specificity,historicalTone,thumbnailSynergy,rationale}]}. ${JSON.stringify({script,plan})}`,titleReport);
 const candidates=ranked.candidates.map(c=>({...c,editorialScore:(c.clarity+c.curiosity+c.specificity+c.historicalTone+c.thumbnailSynergy)/5})).sort((a,b)=>b.editorialScore-a.editorialScore).map((c,i)=>({...c,rank:i+1}));
 await json(join(dir,'titles.json'),{candidates,renderedMetadataTitle:script.title,selectedBeforeProduction:plan.titles[0],notCTRPrediction:true});await json(join(dir,'final-script.json'),script);await json(join(dir,'visual-plan.json'),shots);await json(join(dir,'audio-QA.json'),audioReport);
 const sourceReviews=await Promise.all([...new Set(visuals.assets.map(a=>a.sourceImageId!))].map(async id=>({id,review:await read(join(dir,`native-${id}-density-QA-v4.3.json`))})));
 await json(join(dir,'visual-QA.json'),{render:qa,sources:sourceReviews,subjectiveScoresAdvisory:true,approvedArtDirection:await read('config/channel-art-direction.json')});
 const sfxPath=join(dir,'assets/sfx.wav'),sfxSeconds=await duration(sfxPath);const probe=await exec('ffmpeg',['-hide_banner','-i',sfxPath,'-af','volumedetect','-f','null','-'],{timeout:30000});
 const sfx={passed:Math.abs(sfxSeconds-audio.duration)<.1&&audio.events.every(e=>e.time>=0&&e.time<audio.duration),duration:sfxSeconds,events:audio.events,levelDb:audio.sfxDb,peakMeasurement:probe.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]??null,provenance:'Existing locally synthesized original CC0 sound events, no paid generation',musicProvenance:audio.provenance};await json(join(dir,'sfx-QA.json'),sfx);if(!sfx.passed)throw new Error('SFX bounds/duration invalid');
 const chapters=await read(join(dir,'voice.json'));for(const chapter of chapters.chapters??[])await copyFile(chapter.path,join(dir,'raw-'+chapter.id+'.wav'));
 await json(join(dir,'production-summary.json'),{status:'completed-awaiting-human-review',duration:seconds,visualBeats:shots.shots.length,uniqueVideoSources:new Set(visuals.assets.map(a=>a.sourceSha256)).size,reusedVisualBeats:visuals.assets.length-new Set(visuals.assets.map(a=>a.sourceSha256)).size,voiceProvider:'Chatterbox Nano reference-cloned',paidApiCostUsd:0,autoPublish:false,nextAction:'STOP: channel owner reviews this single 90–105s video; no long pilot authorized',metricsEvidence:['costs.json','free-quota-report.json','logs.jsonl','voice.json']});
}
