import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {z} from 'zod';
import {Runner} from '../orchestration/runner';
import {json,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {FreeFirstLLM} from '../providers/free';
import {validatedJSON} from '../providers/validated-json';
import {CostLedger,withCosts,loadCostPolicy} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {CloudflareReferenceImageProvider} from '../providers/cloudflare';
import {visionImage} from './style-reference-v4';

/**
 * Owner-authorized (2026-10-10) v5 STYLE AUDITION ONLY: a simple, expressive round-head cartoon with an original
 * recurring character. Competitor frames are never sent as references; only abstract principles are used.
 * Produces stills and STYLE-PREVIEW-v5.jpg, then STOPS for human approval. Never changes the locked v4 pipeline.
 */
export const V5_STYLE='Original hand-drawn 2D cartoon for a history explainer channel. Simple round-headed cartoon people: large white circle head, small black dot eyes, bold expressive eyebrows and mouth, thin black line arms and legs, simple flat clothing shapes. Clean confident black ink outlines, flat bright colours, almost no shading, simple backgrounds with plenty of empty space, one clear idea per image, readable at small size. Full-bleed: the drawing reaches every edge of the 16:9 canvas; no frame, border, panel, margin, inset picture, letters, numbers, captions or watermark.';
export const V5_CHARACTER='Recurring original character ELI, an adult man of Iron Age Judah: round white head, short dark-brown beard, ochre-and-brown striped head cloth tied with a band, sand-coloured knee-length linen tunic with a terracotta sash, simple brown sandals.';
export const V5_SIZE={width:1536,height:864} as const;
export const v5Scenes=[
 {id:'v5-01-modern-hook',reference:true,prompt:'A modern adult man drawn in the same round-head style (grey hoodie, jeans, no beard) relaxes on a blue sofa scrolling a phone, a glass of tap water on a side table, cozy living room, warm evening light. He is NOT Eli.'},
 {id:'v5-02-water-jar',reference:true,prompt:'ELI carries a large clay water jar on his shoulder out of an ancient stone city gate, rocky hills and two olive trees behind, bright clear day, slightly tired but cheerful face.'},
 {id:'v5-03-tunnel-dig',reference:true,prompt:'ELI swings an iron pick at the rock face inside a narrow dark tunnel lit only by one small clay oil lamp on a ledge, sweat drops flying, determined frown, chips of stone flying.'},
 {id:'v5-04-breakthrough',reference:true,prompt:'ELI and an older friend with a grey beard (same round-head style, plain brown tunic) see each other through a fresh hole in a thin rock wall inside a tunnel, both overjoyed with huge smiles, each holding a small clay lamp.'},
 {id:'v5-05-cross-section',reference:true,prompt:'Simple side cross-section of a rocky hill: a winding tunnel carries blue water from a small spring cave on the left, under the hill, to a stone pool on the right; a tiny ELI stands proudly beside the pool. Clean diagram-like composition with empty sky, no labels.'},
 {id:'v5-06-siege-night',reference:true,prompt:'Night: ELI peeks worried over the top of a stone city wall; far away on the dark plain many enemy tents and small campfires. Deep blue sky, warm firelight dots.'},
 {id:'v5-07-thumbnail',reference:true,prompt:'YouTube thumbnail art: close-up of ELI, his head and shoulders fill the left half of the frame, eyes wide and mouth open in shock, holding a glowing clay lamp; the right half shows a dark tunnel with glowing blue water. Brighter saturated colours, very simple, uncluttered, strong silhouette.'},
] as const;
export const V5_SINGLE_SCENE='ONE single full scene, NOT a character sheet: never repeat the reference image\'s poses, rows or layout; the reference only shows Eli\'s design and the drawing style.';
export function v5Prompt(scene:string,single=true){const prompt=`${V5_STYLE} ${V5_CHARACTER} ${single?V5_SINGLE_SCENE+' ':''}Scene: ${scene} Adult proportions for the round-head style: no babies, no chibi, no anime, no realistic faces. Period-correct props only for ancient scenes.`;if(prompt.length>2048)throw new Error('v5 prompt exceeds 2048 characters');return prompt;}
const sheetPrompt=()=>v5Prompt('Character model sheet of ELI on a plain flat warm cream background: the same character shown three times side by side at full height, front view neutral, side view walking, front view surprised with raised eyebrows. Identical design in all three.',false);
export const v5Review=z.object({characterConsistent:z.boolean(),roundHeadStyle:z.boolean(),anatomyDefects:z.array(z.string()),anachronisms:z.array(z.string()),frameOrBorder:z.boolean(),textInImage:z.boolean(),matchesScene:z.boolean(),notes:z.string()});
export function v5Passed(r:z.infer<typeof v5Review>){return r.roundHeadStyle&&r.characterConsistent&&r.matchesScene&&!r.frameOrBorder&&!r.textInImage&&!r.anatomyDefects.length&&!r.anachronisms.length;}
export async function runStyleAuditionV5(runId:string){
 if(!/^style-v5-[A-Za-z0-9_-]+$/.test(runId))throw new Error('Use a style-v5-* run ID');
 const dir=join('data/runs',runId),out=join(dir,'stills');await mkdir(out,{recursive:true});
 const ledger=new CostLedger(await loadCostPolicy(),dir);await ledger.restore();const quota=new FreeQuotaLedger(dir);await quota.restore();
 return withQuota(quota,()=>withCosts(ledger,async()=>{const runner=new Runner(dir,undefined,runId);await runner.lock();try{
  const image=new CloudflareReferenceImageProvider(),vision=new FreeFirstLLM();const results:{id:string;path:string;sha256:string;passed:boolean;review:z.infer<typeof v5Review>}[]=[];
  const review=(path:string,scene:string,sheet?:string)=>validatedJSON({json:async<T>(p:string,s:z.ZodType<T>)=>vision.images(p,await Promise.all([visionImage(path),...(sheet?[visionImage(sheet)]:[])]),s)},`Review image 1, an AI cartoon for a history channel style audition.${sheet?' Image 2 is the approved character model sheet of ELI.':''} Requested scene: ${scene} Report honestly: characterConsistent (ELI matches the sheet; true if no sheet or Eli absent by request), roundHeadStyle (simple white round-head cartoon people, not realistic, not anime), anatomyDefects (extra/missing/detached limbs, broken bodies), anachronisms (modern objects in ancient scenes), frameOrBorder (picture inside a frame, panel, inset box or blank margin instead of full-bleed), textInImage (letters, numbers, captions), matchesScene, notes. Return JSON {characterConsistent,roundHeadStyle,anatomyDefects:[],anachronisms:[],frameOrBorder,textInImage,matchesScene,notes}.`,v5Review);
  // Round 2: a multi-pose sheet as input_image_0 made Klein repeat the turnaround layout, so scenes use one cropped pose.
  const draw=async(id:string,prompt:string,scene:string,sheet?:string,round=sheet?'r2':'')=>{for(let attempt=1;attempt<=2;attempt++){const path=join(out,`${id}${round?'-'+round:''}${attempt>1?'-retry':''}.png`);
   const stage=await runner.stage(`v5-${id}${round?'-'+round:''}-${attempt}`,z.object({path:z.string(),sha256:z.string(),review:v5Review}),async()=>{await image.generate(prompt,path,sheet?{referenceImages:[sheet],...V5_SIZE}:{...V5_SIZE,referenceFreeAudition:true});return {path,sha256:await fileDigest(path),review:await review(path,scene,sheet)};});
   const passed=v5Passed(stage.review);if(passed||attempt===2){results.push({id,...stage,passed});return stage.path;}}
   throw new Error('unreachable');};
  const sheet=await draw('v5-00-character-sheet',sheetPrompt(),'ELI character model sheet, three poses');
  const pose=join(out,'eli-front-pose.png');await exec('ffmpeg',['-y','-v','error','-i',sheet,'-vf','crop=iw/3:ih:0:0','-frames:v','1',pose],{timeout:30000});
  for(const scene of v5Scenes)await draw(scene.id,v5Prompt(scene.prompt),scene.prompt,pose);
  const tiles=results.map(r=>r.path);const preview=join(dir,'STYLE-PREVIEW-v5.jpg');
  await exec('ffmpeg',['-y','-v','error',...tiles.flatMap(t=>['-i',t]),'-filter_complex',tiles.map((_,i)=>`[${i}:v]scale=768:432[t${i}]`).join(';')+';'+tiles.map((_,i)=>`[t${i}]`).join('')+`xstack=inputs=${tiles.length}:layout=${tiles.map((_,i)=>`${(i%3)*768}_${Math.floor(i/3)*432}`).join('|')}:fill=white`,'-frames:v','1','-q:v','3',preview],{timeout:120000});
  const summary={runId,style:'v5 round-head audition (owner-authorized 2026-10-10)',character:V5_CHARACTER,preview,results,allPassed:results.every(r=>r.passed),stop:'STOP: owner approves or rejects STYLE-PREVIEW-v5.jpg before any v5 video, thumbnail or branding use',published:false};
  await json(join(dir,'style-v5-summary.json'),summary);return summary;
 }finally{await runner.unlock();}}));
}
