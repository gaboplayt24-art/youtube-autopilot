import type {z} from 'zod';
import {endsVisualPhrase} from './illustrated-edit';
import {voice,plan} from '../orchestration/schemas';
import {shotPlan,type VisualProfile,type Shot,type ShotPlan} from './schemas';
import type {LLMProvider} from '../providers/interfaces';
import {shot as shotSchema} from './schemas';
import {z as schema} from 'zod';
export class HookDirector {
 direct(shot:Shot,index:number):Shot{return {...shot,highImpact:shot.start<5,transition:shot.start<5?'cut':shot.start<30&&index%4===0?'light-leak':index%3===0?'blur':'cut',motion:shot.start<5?'parallax':shot.motion};}
}
export function pacing(shots:Shot[]){const total=shots.at(-1)?.end??0;const acceptable=shots.filter(s=>s.end-s.start>=1&&s.end-s.start<=(total>120?(s.start<30?4.2:['map','chart','timeline','document'].includes(s.shotType)?12:7.5):4.2)).length;return {pacingScore:shots.length?Math.round(acceptable/shots.length*100):0,visualDensity:total?Number((shots.length/total*60).toFixed(2)):0};}
export class ShotPlanner {
 async plan(p:z.infer<typeof plan>,v:z.infer<typeof voice>,profile:VisualProfile,fps:number,llm?:LLMProvider,cinematic=false,qualityPacing?:{hookSeconds:number;bodySeconds:number},preferPhraseBoundaries=false):Promise<ShotPlan>{
  const segments=[];const shots:Shot[]=[];let offset=0;const hook=new HookDirector();
  for(const scene of p.scenes){const audio=v.scenes.find(s=>s.id===scene.id)!;const end=offset+Math.ceil(audio.duration*fps)/fps;segments.push({sceneId:scene.id,start:offset,end,narration:scene.narration});
   // Speech-derived phrase boundaries. Split only at word boundaries; never invent scene durations.
   const units=audio.words??audio.alignment;let start=0;let text='';let part=0;
   for(let i=0;i<units.length;i++){text+=(text?' ':'')+units[i].text;const next=units[i+1];const elapsed=units[i].end-start;const beat=cinematic?(offset+start<30?qualityPacing?.hookSeconds??2.2:qualityPacing?.bodySeconds??3.5):end>120&&offset+start>=30?4.8:2.2;
    const maximum=end>120&&offset+start>=30?7.5:4.2;
    const boundary=preferPhraseBoundaries?endsVisualPhrase(units[i],next,elapsed,beat,maximum):elapsed>=beat;
    if((boundary&&next&&audio.duration-next.start>1.2)||!next){const localEnd=next?next.start:audio.duration;const index=shots.length;const terms=text.toLowerCase();let type:Shot['shotType']=profile.shotTypes.includes('stock-video')?'stock-video':'generated-image';if(profile.name==='stickman'&&index%2===0)type='icon-scene';if(index%6===2&&profile.shotTypes.includes('kinetic-text'))type='kinetic-text';if(index%7===4&&profile.shotTypes.includes('diagram'))type='diagram';
     if(/chart|measurement|fewer competing signals/.test(terms))type='chart';else if(/route|maze|path/.test(terms))type='map';else if(/page|write|task/.test(terms))type='document';else if(/window of time|experiment/.test(terms))type='timeline';else if(index===0)type='generated-image';if(shots.at(-1)?.shotType===type&&!['generated-image','stock-video','stock-image'].includes(type))type='generated-image';
     const item:Shot={id:`${scene.id}-shot-${part++}`,sceneId:scene.id,start:offset+start,end:next?offset+localEnd:end,narration:text,visualIntent:`${scene.visual}. Emphasize: ${text}`,shotType:type,motion:['slow-push-in','pan-left','pull-out','pan-right','parallax'][index%5] as Shot['motion'],assetPrompt:`${profile.motionStyle}. Original editorial illustration, no text or logos: ${scene.visual}; specifically ${text}`,overlay:!llm&&['chart','map','timeline'].includes(type)?(type==='chart'?'FEWER SIGNALS. MORE ROOM.':type==='map'?'THE PATH OF ATTENTION':'ONE SMALL EXPERIMENT'):index%4===2?text.split(/\s+/).slice(0,4).join(' '):null,keywords:text.toLowerCase().match(/[a-z]{5,}/g)?.slice(0,6)??[],data:!llm&&type==='chart'?[18,38,24,72,61,85]:undefined,labels:!llm&&(type==='timeline'||type==='diagram')?['NOTICE','CHOOSE','BEGIN']:!llm&&type==='map'?['DISTRACTION','ONE CLEAR PATH']:!llm&&type==='chart'?['SIGNALS','DIRECTION']:undefined,highImpact:false,transition:'cut'};
     shots.push(hook.direct(item,index));start=localEnd;text='';}
   }offset=end;
  }
  if(llm){for(let batch=0;batch<shots.length;batch+=10){const batchShots=shots.slice(batch,batch+10);const creative=await llm.json(`Direct these speech-timed shots for a ${profile.name} video. Keep their id,sceneId,start,end,narration exactly unchanged. For an AI-first historical channel, prefer generated-image. Optional assetKey may be shared by at most 2 related shots with EXACTLY the same assetPrompt; vary editorialReframe (0 or 1) and motion for distinct details/crops. Do not reuse one image for unrelated narration. Keep assetPrompt <=300 characters; the shared visual bible supplies era, identities and style. Add searchQuery (2-5 concrete subject/name words, no prose). Update visualIntent,shotType,motion,assetPrompt,overlay,keywords,data,labels only to match the exact narration. Never invent statistics; charts must use cited script data or be clearly illustrative. Return {shots:[...]}: ${JSON.stringify(batchShots)}`,schema.object({shots:schema.array(shotSchema)}));if(creative.shots.length!==batchShots.length)throw new Error('Shot director changed timeline');for(let i=0;i<batchShots.length;i++){const a=batchShots[i],b=creative.shots[i];if(['id','sceneId','start','end','narration'].some(k=>a[k as keyof Shot]!==b[k as keyof Shot]))throw new Error('Shot director changed narration timing');shots[batch+i]=hook.direct(b,batch+i);}}}
  return shotPlan.parse({segments,shots,...pacing(shots)});
 }
}
