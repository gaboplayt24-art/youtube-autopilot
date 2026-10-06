import {google} from 'googleapis';
import {analyticsRow,learning} from '../orchestration/schemas';
import {auth} from '../youtube';
import type {LLMProvider} from '../providers/interfaces';
export async function collect(videoId:string,context:Record<string,unknown>,startDate:string,endDate:string){
 const a=auth();const yt=google.youtube({version:'v3',auth:a});const details=await yt.videos.list({id:[videoId],part:['snippet']});const api=google.youtubeAnalytics({version:'v2',auth:a});
 const metrics=['views','averageViewDuration','averageViewPercentage','likes','comments','subscribersGained'];const res=await api.reports.query({ids:'channel==MINE',startDate,endDate,metrics:metrics.join(','),filters:`video==${videoId}`});const row=res.data.rows?.[0]??metrics.map(()=>0);const values=Object.fromEntries(metrics.map((name,i)=>[name,Number(row[i])]));
 return analyticsRow.parse({...context,videoId,publishTime:details.data.items?.[0]?.snippet?.publishedAt??null,...values,averagePercentageViewed:values.averageViewPercentage,impressions:null,ctr:null});
}
export async function learn(rows:unknown[],llm?:LLMProvider){const valid=rows.map(x=>analyticsRow.parse(x));if(llm)return llm.json(`Analyze these metrics: ${JSON.stringify(valid)}. Produce suggestions only, never changes to safety or publication rules. Return {generatedAt,sampleSize,recommendations:[{recommendation,evidence,requiresHumanReview:true}]}. Use null metrics as unavailable, never infer impressions or CTR.`,learning);return learning.parse({generatedAt:new Date().toISOString(),sampleSize:valid.length,recommendations:valid.length?[{recommendation:'Review the hooks of videos with above-median average percentage viewed.',evidence:JSON.stringify(valid.map(x=>({videoId:x.videoId,retention:x.averagePercentageViewed}))),requiresHumanReview:true}]:[]});}
