import {google} from 'googleapis';
import {auth} from '../src/youtube';
import {json} from '../src/orchestration/io';
import {GeminiProvider} from '../src/providers/free';
import {translateClipTitles,shortMetadata} from '../src/social/localize';
/** Owner-approved 2026-11-13: Shorts uploaded with the angel episode's fixed es/pt-BR table get their own faithful translations.
 * Only the description and localizations change; the English title, tags, thumbnail, privacy and schedule stay exactly as they are. */
const root='.cache/short-localization-fix';
export function parseShort(snippet:{title?:string|null;description?:string|null}){
 const title=(snippet.title??'').replace(/\s*#Shorts\s*$/i,'').trim(),d=snippet.description??'';
 const source=d.match(/Text reference: (.+)/)?.[1]?.trim(),main=d.match(/Full illustrated episode: https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/)?.[1];
 if(!title||!source||!main)throw Error('Short description is not in the generated format; refusing to guess');
 return {title,source,main};
}
async function main(){
 const ids=(process.env.VIDEO_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);if(!ids.length||ids.some(id=>!/^[\w-]{11}$/.test(id)))throw Error('VIDEO_IDS required');
 const youtube=google.youtube({version:'v3',auth:auth()});
 const mine=(await youtube.channels.list({part:['id'],mine:true})).data.items?.[0]?.id;if(!mine)throw Error('Channel not found');
 const before=(await youtube.videos.list({part:['snippet','localizations','status'],id:ids})).data.items??[];if(before.length!==ids.length)throw Error('Some videos are unavailable');
 if(before.some(v=>v.snippet?.channelId!==mine))throw Error('A video does not belong to the authenticated channel');
 await json(root+'/before.json',{at:new Date().toISOString(),videos:before});
 const parsed=before.map(v=>({id:v.id!,...parseShort(v.snippet!)}));
 const llm=new GeminiProvider();await llm.discover();const translations=await translateClipTitles(llm,parsed.map(p=>({id:p.id,title:p.title})));
 const plan=parsed.map(p=>({videoId:p.id,...shortMetadata({id:p.id,title:p.title,source:p.source},p.main,'episode',translations)}));
 await json(root+'/preview.json',{plan});
 if(process.env.APPLY!=='true'){console.log(JSON.stringify({mode:'preview',plan}));return;}
 const receipts=[];
 for(const p of plan){
  const v=before.find(x=>x.id===p.videoId)!,s=v.snippet!;
  if(p.title!==s.title)throw Error('English title would change; refusing for '+p.videoId);
  await youtube.videos.update({part:['snippet','localizations'],requestBody:{id:p.videoId,snippet:{title:s.title,description:p.description,tags:s.tags,categoryId:s.categoryId,defaultLanguage:s.defaultLanguage??'en',defaultAudioLanguage:s.defaultAudioLanguage??'en'},localizations:{...(v.localizations??{}),...p.localizations}}});
  const after=(await youtube.videos.list({part:['snippet','localizations','status'],id:[p.videoId]})).data.items?.[0];
  const same=(a?:string|null,b?:string|null)=>(a??null)===(b??null)||(!!a&&!!b&&Date.parse(a)===Date.parse(b));
  const checks={title:after?.snippet?.title===s.title,es:after?.localizations?.es?.title===p.localizations.es.title,ptBR:after?.localizations?.['pt-BR']?.title===p.localizations['pt-BR'].title,privacy:after?.status?.privacyStatus===v.status?.privacyStatus,schedule:same(after?.status?.publishAt,v.status?.publishAt)};
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
  if(failed.length)throw Error(`Verification failed for ${p.videoId}: ${failed.join(',')} (privacy ${v.status?.privacyStatus}→${after?.status?.privacyStatus}, publishAt ${v.status?.publishAt}→${after?.status?.publishAt})`);
  receipts.push({videoId:p.videoId,title:s.title,es:p.localizations.es.title,ptBR:p.localizations['pt-BR'].title,url:'https://youtube.com/shorts/'+p.videoId});
 }
 await json(root+'/after.json',{receipts});console.log(JSON.stringify({mode:'applied',receipts}));
}
if(process.argv[1]?.endsWith('fix-short-localizations.ts'))main().catch(e=>{console.error(JSON.stringify({event:'short_localization_fix_failed',message:(e as Error).message}));process.exitCode=1;});
