// Owner-requested 2026-10-28 free SEO: measured chapter timestamps (YouTube "key moments", also shown in Google
// results), search-phrase tags and hashtags, added deterministically to the approved metadata. Sources, disclosures
// and the title are never changed.
export const BASE_TAGS=['bible history','biblical history','bible explained','bible stories','bible documentary','old testament','ancient history','biblical archaeology'];
export const HASHTAGS='#BibleHistory #BibleExplained #BibleStories';
const stamp=(seconds:number)=>{const s=Math.floor(seconds),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${r}`:`${m}:${r}`;};
/** YouTube shows chapters only when the first starts at 0:00, there are at least three and each lasts 10 s or more. */
export function chapterLines(scenes:{id:string;from:number;frames:number}[],fps:number,titles:Record<string,string>){
 if(scenes.length<3||scenes.some(s=>s.frames/fps<10))return [];
 return scenes.map((s,i)=>`${stamp(s.from/fps)} ${titles[s.id]??(i===0?'The question':i===scenes.length-1?'The answer':`Part ${i}`)}`);
}
export function seoDescription(description:string,chapters:string[]){
 const body=description.replace(/\n*#\w+(?:\s+#\w+)*\s*$/,'');
 const [first,...rest]=body.split(/\n\n/);
 const parts=[first,...(chapters.length?['Chapters:\n'+chapters.join('\n')]:[]),...rest,HASHTAGS];
 return parts.join('\n\n').slice(0,4900);
}
/** Topic tags first, then the channel's base phrases; YouTube allows 500 characters in total. */
export function seoTags(tags:string[]){
 const out:string[]=[];let length=0;
 for(const tag of [...tags,...BASE_TAGS].map(t=>t.trim().toLowerCase().replace(/[<>,]/g,'')).filter(Boolean)){
  if(out.length>=30||out.includes(tag)||length+tag.length+(tag.includes(' ')?2:0)+1>480)continue;out.push(tag);length+=tag.length+(tag.includes(' ')?2:0)+1;
 }
 return out;
}
