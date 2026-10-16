import type {Shot} from './schemas';

export type TimedWord={text:string;start:number;end:number};
const token=(text:string)=>text.toLowerCase().replace(/[^\p{L}\p{N}']/gu,'');

/** Prefer a real phrase/pause, but never let waiting for punctuation create a long hold. */
export function endsVisualPhrase(current:TimedWord,next:TimedWord|undefined,elapsed:number,target:number,maximum:number){
 if(!next)return true;
 if(elapsed<target)return false;
 return /[.!?;:,]["')\]]?$/.test(current.text)||next.start-current.end>=.16||elapsed+(next.end-current.end)>=maximum;
}

/** Match real aligned speech, never spread invented timestamps across a phrase. */
export function spokenLabelStart(label:string,words:TimedWord[]):number|undefined{
 const wanted=label.split(/\s+/).map(token).filter(Boolean);
 if(!wanted.length)return undefined;
 for(let i=0;i<=words.length-wanted.length;i++){
  if(wanted.every((text,j)=>token(words[i+j].text)===text))return words[i].start;
 }
 return undefined;
}

/** Editorial annotations over original FLUX art; no extra inference or asset reuse. */
export function directIllustratedEdit(shots:Shot[],words:TimedWord[]):Shot[]{
 return shots.map(s=>{
  const local=words.filter(w=>w.start>=s.start&&w.end<=s.end+.001);
  const at=s.overlay?spokenLabelStart(s.overlayAnchor??s.overlay,local):undefined;
  // A paraphrased label needs an explicit, exact spoken anchor.
  // Omit their callout until an explicit, speech-matching anchor is provided.
  const label=s.overlay&&at!==undefined&&s.end-at>=.6?s.overlay:null;
  return {...s,transition:'cut',overlay:label,editorialTiming:label?{start:at!,end:s.end,anchor:s.overlayAnchor??label}:undefined};
 });
}

/** A bounded 2D camera. Flat artwork is never passed off as independent character animation. */
export function illustratedCamera(motion:Shot['motion'],frame:number,frames:number){
 const t=Math.max(0,Math.min(1,frame/Math.max(1,frames-1)));
 const eased=t*t*(3-2*t);
 const pan=motion==='pan-left'?-12*eased:motion==='pan-right'?12*eased:0;
 const zoom=motion==='pull-out'?1.035-.02*eased:1.015+.02*eased;
 return {pan,zoom};
}

export function annotationProgress(time:number,start:number,end:number){
 if(time<start||time>=end)return 0;
 return Math.max(0,Math.min(1,(time-start)/.18));
}
