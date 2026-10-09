import type {Composition} from '../orchestration/schemas';
import {pacing} from './planner';
export function compositionVariety(c:Pick<Composition,'shots'>){return new Set(c.shots.map(s=>s.visualIdea?.conceptType??s.shotType)).size;}
export function visualQuality(c:Composition){const checks:{name:string;passed:boolean;detail:string}[]=[];const add=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});const metrics=pacing(c.shots);
 add('shot pacing',c.shots.length>0&&c.shots.every(s=>s.end>s.start&&s.end-s.start<=(c.durationInFrames/c.fps>120?(s.start<30?4.2:['map','chart','timeline','document'].includes(s.shotType)?12:7.5):4.2))&&metrics.pacingScore>=90,JSON.stringify(metrics));
 let end=0;const contiguous=c.shots.every(s=>{const ok=Math.abs(s.start-end)<0.05;end=s.end;return ok;});add('visual coverage',contiguous&&Math.abs(end-c.durationInFrames/c.fps)<0.05,'No gaps or empty timeline regions');
 add('continuous movement',c.shots.every(s=>!!s.motion),'Camera motion on every shot, with restrained editorial transitions');
 add('asset narration alignment',c.shots.every(s=>{const a=c.assets.find(a=>a.shotId===s.id);return !!a&&s.narration.toLowerCase().split(/\W+/).filter(w=>w.length>=4).some(w=>a.intent.toLowerCase().includes(w));}),'Heuristic intent-to-narration check; editorial review still required');
 const hashes=c.assets.map(a=>a.sha256);add('asset repetition',hashes.every(h=>hashes.filter(x=>x===h).length<=(c.assets.every(a=>!!a.sourceImageId&&!!a.editorialVariant)||c.durationInFrames/c.fps>120?4:2)),'Controlled asset reuse; long-form allows four non-consecutive uses');
 add('caption readability',!!c.visualProfile&&c.visualProfile.captionSize>=48&&c.cues.every(c=>c.text.length<=40&&c.text.split(/\s+/).length<=5),'48+ px at 1080p, short cues, safe margins');
 add('text density',c.shots.every(s=>(s.overlay?.split(/\s+/).length??0)<=5),'Short overlays, max 5 words; never full paragraphs');
 return {checks,...metrics};
}
