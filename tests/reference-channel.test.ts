import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicYouTubeClient} from '../src/packaging/engine';
import {analyzeReferenceChannel} from '../src/ideas/reference-channel';
test('most viewed reference is found across pages; incomplete traversal and undisclosed counts remain explicit',async()=>{
 const client=new PublicYouTubeClient('test',async()=>{throw new Error('No external calls in tests');});
 client.get=async(route,params)=>{
  if(route==='channels')return {items:[{id:'c',snippet:{title:'Reference',description:'Example'},statistics:{videoCount:'3'},contentDetails:{relatedPlaylists:{uploads:'p'}}}]};
  if(route==='playlistItems')return params.pageToken?{items:[{contentDetails:{videoId:'older-winner'}},{contentDetails:{videoId:'hidden-views'}}]}:{items:[{contentDetails:{videoId:'newest'}}],nextPageToken:'next'};
  return {items:params.id.split(',').map(id=>({id,snippet:{title:id,description:'Example',publishedAt:'2026-01-01T00:00:00Z',thumbnails:{high:{url:'https://example.com/thumbnail.jpg'}}},statistics:id==='hidden-views'?{}:{viewCount:id==='older-winner'?'10000':'10'},contentDetails:{duration:'PT10M'}}))};
 };
 const report=await analyzeReferenceChannel('@reference',client);assert.equal(report.mostViewedPublicVideo?.videoId,'older-winner');assert.equal(report.playlistTraversalComplete,true);assert.equal(report.missingViewCounts,1);assert.equal(report.videos.at(-1)?.views,null);
 const limited=await analyzeReferenceChannel('@reference',client,new Date(),1);assert.equal(limited.playlistTraversalComplete,false);assert.equal(limited.mostViewedPublicVideo?.videoId,'newest');
 await assert.rejects(()=>analyzeReferenceChannel('https://untrusted.example',client));
});
