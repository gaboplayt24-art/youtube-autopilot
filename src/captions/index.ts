import type {z} from 'zod';
import {voice,plan,captions} from '../orchestration/schemas';
export function createCaptions(p:z.infer<typeof plan>,v:z.infer<typeof voice>,fps=30){let offset=0;const cues:z.infer<typeof captions>['cues']=[];for(const scene of p.scenes){const audio=v.scenes.find(x=>x.id===scene.id);if(!audio)throw new Error('Missing scene narration');const words=audio.words??audio.alignment;let group:typeof words=[];
 const flush=()=>{if(!group.length)return;cues.push({sceneId:scene.id,start:offset+group[0].start,end:offset+group.at(-1)!.end,text:group.map(x=>x.text).join(' '),words:group.map(w=>({...w,start:offset+w.start,end:offset+w.end}))});group=[];};
 for(const segment of words){if(segment.start>=segment.end||segment.end>audio.duration+0.1)throw new Error('Invalid speech alignment');if(group.length&&(group.length>=4||[...group,segment].map(x=>x.text).join(' ').length>32))flush();group.push(segment);}flush();offset+=Math.ceil(audio.duration*fps)/fps;}return {cues};}
