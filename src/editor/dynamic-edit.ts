import type {DynamicEdit,Shot} from './schemas';
import type {TimedWord} from './illustrated-edit';

/** Owner-supplied editorial titles for numbered chapter cards; never generated claims. */
export type ChapterTitles=Record<string,string>;
export type Focus=Record<string,[number,number]>;
export type Zones=Record<string,'top'|'left'|'right'>;
type Claim={text:string};
type Scene={id:string;start:number;claims?:Claim[]};

const BOOKS=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','Samuel','Kings','Chronicles','Ezra','Nehemiah','Esther','Job','Psalm','Psalms','Proverbs','Ecclesiastes','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','Corinthians','Galatians','Ephesians','Philippians','Colossians','Thessalonians','Timothy','Titus','Philemon','Hebrews','James','Peter','Jude','Revelation','Tobit'];
const bookPattern=new RegExp(`^(${BOOKS.join('|')})(?:['’]s)?[,.;:]?$`);
const reference=/^(\d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?)[,.;:]?$/;
const pause=(word:TimedWord,next?:TimedWord)=>/[.!?;:,]["')\]]?$/.test(word.text)||(next!==undefined&&next.start-word.end>=.16);

// Wide establishing frame, then progressively closer punch-ins toward the image's visual focus.
const FRAMINGS=[{scale:1.05,pull:.25},{scale:1.24,pull:.8},{scale:1.34,pull:1},{scale:1.16,pull:.55}];
const LAYERED_FRAMINGS=[{scale:1.02,pull:.2},{scale:1.16,pull:.85},{scale:1.08,pull:.5},{scale:1.22,pull:1}];
const TRANSITIONS=['whip-left','zoom','whip-right','cut'] as const;
const MIN_BEAT=1.5;

function beatCount(seconds:number){return seconds<3.4?1:seconds<5.8?2:seconds<8.6?3:4;}

/** Split points prefer spoken phrase ends near an even rhythm, and never create a beat under MIN_BEAT. */
export function splitShot(shot:Shot,words:TimedWord[]):number[]{
 const count=beatCount(shot.end-shot.start);const cuts:number[]=[];
 const local=words.filter(w=>w.end>shot.start+MIN_BEAT&&w.end<shot.end-MIN_BEAT);
 for(let i=1;i<count;i++){
  const target=shot.start+(shot.end-shot.start)*i/count,previous=cuts.at(-1)??shot.start;
  let best:number|undefined,score=Infinity;
  local.forEach((w,j)=>{if(w.end-previous<MIN_BEAT)return;const value=Math.abs(w.end-target)-(pause(w,local[j+1])?.6:0);if(value<score){score=value;best=w.end;}});
  if(best!==undefined&&Math.abs(best-target)<1.4)cuts.push(Number(best.toFixed(3)));
 }
 return cuts;
}

/** Keep the framed window inside the artwork so no empty edge is ever revealed. */
export function frameCenter(scale:number,focus:[number,number],pull:number){
 const limit=(1-1/scale)/2;const towards=(f:number)=>.5+Math.max(-limit,Math.min(limit,(f-.5)*pull));
 return {centerX:Number(towards(focus[0]).toFixed(4)),centerY:Number(towards(focus[1]).toFixed(4))};
}

/** "Isaiah 6:2" spoken directly, otherwise the scene's own cited claim for that book. */
export function verseReferences(words:TimedWord[],scenes:Scene[]){
 const found:{time:number;title:string}[]=[];
 words.forEach((w,i)=>{
  const book=w.text.match(bookPattern)?.[1];if(!book||/['’]s/.test(w.text))return;
  const spoken=words[i+1]?.text.match(reference)?.[1];
  const scene=[...scenes].reverse().find(s=>s.start<=w.start);
  const cited=scene?.claims?.map(c=>c.text.match(new RegExp(`\\b${book} (\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?)`))?.[1]).find(Boolean);
  const ref=spoken??cited;if(!ref)return;
  found.push({time:w.start,title:`${book} ${ref}`.toUpperCase()});
 });
 return found;
}

/** Cut-out actors found in an approved illustration (fractions of the frame), from scripts/extract-layers.py. */
export type Layers=Record<string,{background:string;actors:{path:string;x:number;y:number;width:number;height:number}[]}>;
const ENTRIES=['pop','rise','slide-left','slide-right'] as const;

export function planDynamicEdit({shots,words,scenes,titles,focus,zones={},layers={},presenter=[]}:{shots:Shot[];words:TimedWord[];scenes:Scene[];titles:ChapterTitles;focus:Focus;zones?:Zones;layers?:Layers;presenter?:string[]}):DynamicEdit{
 const beats:DynamicEdit['beats']=[];const pops:DynamicEdit['pops']=[];const cards:DynamicEdit['cards']=[];const scenesOut:DynamicEdit['layers']=[];
 let transition=0;
 shots.forEach((shot,index)=>{
  const layer=layers[shot.id];
  // Actors enter one after another as the shot opens, like pieces placed on a stage.
  const actors=layer?.actors.map((a,i)=>({...a,entry:ENTRIES[(index+i)%2],delay:Number((i*.22).toFixed(2))}));
  if(layer&&actors)scenesOut.push({shotId:shot.id,background:layer.background,actors});
  const lead=layer?.actors.reduce((a,b)=>a.width*a.height>=b.width*b.height?a:b);
  // Arrows only point at a single upright figure, never at a merged group or a prop.
  const head:[number,number]|undefined=lead&&lead.height*1080>lead.width*1920*1.25?[lead.x+lead.width/2,lead.y+lead.height*.12]:undefined;
  const point:[number,number]=lead?[lead.x+lead.width/2,lead.y+lead.height*.4]:focus[shot.id]??[.5,.45];
  const bounds=[shot.start,...splitShot(shot,words),shot.end];
  const newScene=index>0&&shots[index-1].sceneId!==shot.sceneId;
  for(let i=0;i<bounds.length-1;i++){
   // Layered shots never hard-cut inside themselves: the camera glides to the next framing.
   const framing=layer?LAYERED_FRAMINGS[i%LAYERED_FRAMINGS.length]:FRAMINGS[i%FRAMINGS.length];
   const entry=i>0?(layer?'glide':'punch'):index===0?'cut':newScene?'zoom':TRANSITIONS[transition++%TRANSITIONS.length];
   beats.push({shotId:shot.id,start:bounds[i],end:bounds[i+1],scale:framing.scale,...frameCenter(framing.scale,point,framing.pull),drift:(index+i)%2?1:-1,entry});
  }
  if(shot.overlay&&shot.editorialTiming){const start=shot.editorialTiming.start,end=Math.min(shot.end-.05,start+2.8);if(end-start>=.8)pops.push({start,end,text:shot.overlay,placement:zones[shot.id]??'top',...(head?{target:head}:{})});}
 });
 scenes.forEach((scene,i)=>{const title=titles[scene.id];if(i>0&&title)cards.push({kind:'chapter',start:scene.start,end:scene.start+2.6,title,number:i});});
 // Verse chips stay up while the passage is discussed: at most one every 20 seconds, never over a chapter card.
 for(const verse of verseReferences(words,scenes)){
  const last=cards.filter(c=>c.kind==='verse').at(-1);
  if(last&&verse.time-last.start<20)continue;
  if(cards.some(c=>c.kind==='chapter'&&verse.time<c.end+.5&&verse.time+3.2>c.start))continue;
  const next=scenes.find(s=>s.start>verse.time)?.start??Infinity;
  cards.push({kind:'verse',start:verse.time,end:Math.min(verse.time+8,next-.1),title:verse.title});
 }
 cards.sort((a,b)=>a.start-b.start);
 // A label never competes with a chapter card, and moves right of a verse chip.
 const free=pops.filter(p=>!cards.some(c=>c.kind==='chapter'&&p.start<c.end&&p.end>c.start)).map(p=>cards.some(c=>c.kind==='verse'&&p.start<c.end&&p.end>c.start)?{...p,placement:'right' as const}:p);
 pops.length=0;pops.push(...free);
 const sfx:DynamicEdit['sfx']=[];
 const add=(time:number,type:DynamicEdit['sfx'][number]['type'],gap=.4)=>{time=Math.max(0,Number(time.toFixed(3)));if(!sfx.some(s=>Math.abs(s.time-time)<gap))sfx.push({time,type});};
 for(const card of cards)add(card.start,card.kind==='chapter'?'boom':'shimmer');
 for(const beat of beats)if(beat.entry!=='cut'&&beat.entry!=='punch'&&beat.entry!=='glide')add(beat.start-.12,'whoosh');
 for(const pop of pops)add(pop.start,'pop');
 for(const scene of scenesOut){const shot=shots.find(s=>s.id===scene.shotId)!;for(const a of scene.actors)add(shot.start+a.delay,'pop',.22);}
 sfx.sort((a,b)=>a.time-b.time);
 return {version:'dynamic-v1',beats,pops,cards,layers:scenesOut,sfx,presenter};
}
