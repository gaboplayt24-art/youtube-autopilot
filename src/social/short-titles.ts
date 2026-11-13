import {z} from 'zod';
import type {LLMProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
/** Channel data (Nov 2026): Shorts titled as curiosity questions ("Why These Biblical Beings Have Six Wings")
 * drew hundreds to over a thousand views, chapter-card titles ("A decree and a prayer") single digits. */
export const shortTitles=z.object({titles:z.array(z.object({sceneId:z.string(),title:z.string().min(12).max(70)})).max(6)});
export type ShortTitles=z.infer<typeof shortTitles>;
const clean=(t:string)=>t.replace(/#\w+/g,'').replace(/\s+/g,' ').trim();
export function shortTitlesPrompt(episodeTitle:string,chapters:{sceneId:string;opening:string}[]){
 return `Write one YouTube Shorts title for each chapter of a biblical-history episode ("${episodeTitle}"). The Short is the chapter's opening 20-40 seconds, quoted here. Audience: English-speaking, mostly US adults.
Rules: 12-60 characters; a curiosity question or surprising statement about what THIS opening actually says; at most one word in CAPS; plain words; no hashtags, emojis or quotation marks; never promise anything the opening does not show; present the Bible as an ancient text (no claims that something is proven or debunked); never copy another channel's title.
Return {"titles":[{"sceneId":string,"title":string}]} with exactly these sceneIds.
${JSON.stringify(chapters)}`;
}
/** Shorts after the hook, the same chapters the automatic selection cuts. Titles outside the rules are dropped, so the chapter card stays. */
export async function shortHookTitles(llm:LLMProvider,episodeTitle:string,scenes:{id:string;narration:string}[]):Promise<ShortTitles>{
 const chapters=scenes.slice(1,6).map(s=>({sceneId:s.id,opening:s.narration.split(/\s+/).slice(0,110).join(' ')}));
 if(!chapters.length)return {titles:[]};
 const result=await validatedJSON(llm,shortTitlesPrompt(episodeTitle,chapters),shortTitles);
 const ids=new Set(chapters.map(c=>c.sceneId));
 return {titles:result.titles.map(t=>({sceneId:t.sceneId,title:clean(t.title)})).filter(t=>ids.has(t.sceneId)&&t.title.length>=12&&t.title.length<=70)};
}
