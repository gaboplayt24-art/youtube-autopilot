import {z} from 'zod';
import {read} from '../orchestration/io';
export const supportConfig=z.object({enabled:z.boolean(),platform:z.literal('ko-fi'),url:z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='ko-fi.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname);},'Use a direct public Ko-fi creator URL')});
export async function loadSupportConfig(){return supportConfig.parse(await read('config/support.json'));}
/** Append after original evidence/credits. Never overwrite a cached stage or edit a remote video. */
export function appendSupportFooter(description:string,input:z.input<typeof supportConfig>){
 const conf=supportConfig.parse(input);if(!conf.enabled)return description;
 const links=description.match(/https?:\/\/[^\s<>]+/g)??[];
 const existing=links.filter(link=>{try{return new URL(link).hostname==='ko-fi.com';}catch{return false;}});
 if(existing.some(link=>link.replace(/[).,;]+$/,'').replace(/\/$/,'')!==conf.url.replace(/\/$/,'')))throw Error('Different Ko-fi destination in metadata; review before upload');
 if(existing.length)return description;
 const result=description+'\n\nSupport independent illustrated Bible history (optional): '+conf.url+'\nWatching and sharing already helps. Thank you!';
 return z.string().max(5000,'Support footer would exceed YouTube description limit; preserve sources and revise metadata').parse(result);
}
