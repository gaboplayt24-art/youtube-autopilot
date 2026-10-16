import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observedVideo,researchBiblicalDemand} from '../src/ideas/biblical-demand';
import {PublicYouTubeClient} from '../src/packaging/engine';
const now=new Date('2026-10-14T12:00:00Z'),since=new Date('2026-04-17T12:00:00Z');
const video={id:'sample',snippet:{title:'Original history sample',channelId:'c',channelTitle:'Sample',publishedAt:'2026-10-04T12:00:00Z',defaultAudioLanguage:'en'},statistics:{viewCount:'1000'},contentDetails:{duration:'PT10M'}};
test('interest evidence retains measured views, rejects shorts/live/future/non-English and never manufactures missing statistics',()=>{
 assert.equal(observedVideo(video,now,since)?.viewsPerDay,100);
 assert.equal(observedVideo({...video,statistics:{}},now,since),null);
 assert.equal(observedVideo({...video,contentDetails:{duration:'PT30S'}},now,since),null);
 assert.equal(observedVideo({...video,liveStreamingDetails:{}},now,since),null);
 assert.equal(observedVideo({...video,snippet:{...video.snippet,defaultAudioLanguage:'es'}},now,since),null);
 assert.equal(observedVideo({...video,snippet:{...video.snippet,publishedAt:'2027-01-01T00:00:00Z'}},now,since),null);
});
test('topic comparison deduplicates video requests and cannot present views as search volume',async()=>{
 const client=new PublicYouTubeClient('test',async()=>{throw new Error('Real API forbidden in test');});let videoCalls=0;
 client.get=async(route)=>route==='search'?{items:[{id:{videoId:'sample'}},{id:{videoId:'sample'}}]}:(videoCalls++,{items:[video]});
 const report=await researchBiblicalDemand(client,now);assert.equal(videoCalls,1);assert.equal(report.searchVolume,null);assert.equal(report.topics.length,8);assert.ok(report.topics.every(t=>t.sampleSize===1&&t.medianViewsPerDay===100));assert.equal(report.paidApiCostUsd,0);
});
