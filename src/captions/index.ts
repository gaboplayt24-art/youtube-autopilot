import type {z} from 'zod';
import {voice,plan,captions} from '../orchestration/schemas';
export function createCaptions(p:z.infer<typeof plan>,v:z.infer<typeof voice>,fps=30){let offset=0;const cues:z.infer<typeof captions>['cues']=[];for(const scene of p.scenes){const audio=v.scenes.find(x=>x.id===scene.id);if(!audio)throw new Error('Missing scene narration');const words=audio.words??audio.alignment;let group:typeof words=[];
 const flush=()=>{if(!group.length)return;cues.push({sceneId:scene.id,start:offset+group[0].start,end:offset+group.at(-1)!.end,text:group.map(x=>x.text).join(' '),words:group.map(w=>({...w,start:offset+w.start,end:offset+w.end}))});group=[];};
 for(const segment of words){if(segment.start>=segment.end||segment.end>audio.duration+0.1)throw new Error('Invalid speech alignment');if(group.length&&(group.length>=4||[...group,segment].map(x=>x.text).join(' ').length>32))flush();group.push(segment);}flush();offset+=Math.ceil(audio.duration*fps)/fps;}return {cues};}

/** Voice QA accepts measured ASR word spans that overlap by up to 20 ms; captions must not overlap at all, so such a boundary is split at its midpoint. Larger overlaps are left for caption QA to reject. */
export function settleCueBoundaries<T extends {start:number;end:number;words?:{start:number;end:number}[]}>(cues:T[],toleranceSeconds=0.02):T[]{
 const out=cues.map(c=>({...c,words:c.words?.map(w=>({...w}))}));
 for(let i=1;i<out.length;i++){const prev=out[i-1],cur=out[i];const overlap=prev.end-cur.start;if(overlap<=0||overlap>toleranceSeconds+1e-9)continue;const mid=(prev.end+cur.start)/2;prev.end=mid;cur.start=mid;const lw=prev.words?.at(-1);if(lw)lw.end=Math.min(lw.end,mid);const fw=cur.words?.[0];if(fw)fw.start=Math.max(fw.start,mid);}
 return out;
}
