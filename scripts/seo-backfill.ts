// Owner-requested 2026-10-28: add measured chapters, hashtags and search-phrase tags to already published long
// videos. Each video's snippet is backed up first and the remote result verified; titles, thumbnails, privacy,
// schedules and every existing line of the description are kept. DRY_RUN=true only prints the planned change.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {google} from 'googleapis';
import {z} from 'zod';
import {auth} from '../src/youtube/index';
import {seoDescription,seoTags,HASHTAGS} from '../src/packaging/seo';
const plan=z.object({videos:z.array(z.object({videoId:z.string(),runId:z.string(),chapters:z.array(z.string()),tags:z.array(z.string())}))}).parse(JSON.parse(await readFile('data/seo/backfill-2026-10-28.json','utf8')));
const youtube=google.youtube({version:'v3',auth:auth()}),dry=process.env.DRY_RUN!=='false',out='data/research/seo-backfill';await mkdir(out,{recursive:true});
const hidden=(t:string)=>/^bu-|-\d{3}(?:-|$)/.test(t);
const report:Record<string,unknown>[]=[];
for(const v of plan.videos){
 const item=(await youtube.videos.list({id:[v.videoId],part:['snippet']})).data.items?.[0];if(!item?.snippet?.title)throw Error('Video not found: '+v.videoId);
 const s=item.snippet,before={title:s.title,description:s.description??'',tags:s.tags??[],categoryId:s.categoryId,defaultLanguage:s.defaultLanguage,defaultAudioLanguage:s.defaultAudioLanguage};
 await writeFile(`${out}/${v.videoId}-before.json`,JSON.stringify(before,null,1));
 const already=/^Chapters:$/m.test(before.description);
 const description=already&&before.description.trimEnd().endsWith(HASHTAGS)?before.description:seoDescription(before.description,already?[]:v.chapters);
 // Hidden per-run tags guard against duplicate uploads, so they stay first.
 const tags=seoTags([...before.tags.filter(hidden),...v.tags,...before.tags.filter(t=>!hidden(t))]);
 const kept=before.description.split('\n').filter(l=>l.trim()&&!/^#\w/.test(l.trim())).every(l=>description.includes(l));
 if(!kept)throw Error('Planned description would drop existing text: '+v.videoId);
 const after={...before,description,tags};report.push({videoId:v.videoId,dryRun:dry,chaptersAdded:already?0:v.chapters.length,tagsBefore:before.tags.length,tagsAfter:tags.length});
 await writeFile(`${out}/${v.videoId}-planned.json`,JSON.stringify(after,null,1));
 if(dry)continue;
 await youtube.videos.update({part:['snippet'],requestBody:{id:v.videoId,snippet:{title:before.title,description,tags,categoryId:before.categoryId,defaultLanguage:before.defaultLanguage,defaultAudioLanguage:before.defaultAudioLanguage}}});
 const check=(await youtube.videos.list({id:[v.videoId],part:['snippet']})).data.items?.[0]?.snippet;
 // YouTube may normalize whitespace; record any real difference instead of hiding it.
 const norm=(t:string|null|undefined)=>(t??'').replace(/\s+/g,' ').trim(),first=[...norm(description)].findIndex((c,i)=>c!==norm(check?.description)[i]);
 const differs={title:check?.title!==before.title,description:norm(check?.description)!==norm(description),firstDescriptionDifference:first,remoteAround:norm(check?.description).slice(Math.max(0,first-80),first+80),plannedAround:norm(description).slice(Math.max(0,first-80),first+80)};
 (report.at(-1) as Record<string,unknown>).remote=differs;
 if(differs.title)throw Error('Remote title changed unexpectedly: '+v.videoId);
 await writeFile(`${out}/${v.videoId}-after.json`,JSON.stringify({title:check.title,description:check.description,tags:check.tags},null,1));
}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,1));console.log(JSON.stringify(report));
