import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chooseShortWindow,shortTitle,shortDescription,shortLocalizations} from '../src/shorts';
import {shortPublishAt} from '../src/youtube';
import {chunkPlan,tiktokCaption,sendToTikTok,tiktokConfig} from '../src/tiktok';

const beat=(start:number,end:number,narration:string)=>({start,end,narration});
test('Short window ends on the last sentence-closing beat inside 58 seconds',()=>{
 const shots=[beat(0,3,'Right now, you can turn a tap.'),beat(3,30,'In ancient Jerusalem, water decided'),beat(30,52,'whether a city lived or died.'),beat(52,57,'Problem number one'),beat(57,63,'the water was outside.')];
 assert.deepEqual(chooseShortWindow(shots),{startSeconds:0,endSeconds:52});
 assert.throws(()=>chooseShortWindow([beat(0,70,'Too long.')]),/No beat boundary/);
});
test('Short title carries one #Shorts marker within 100 characters',()=>{
 assert.equal(shortTitle('Tunneling in Darkness'),'Tunneling in Darkness #Shorts');
 assert.equal(shortTitle('Tunneling in Darkness #shorts'),'Tunneling in Darkness #Shorts');
 const long=shortTitle('word '.repeat(30));assert.ok(long.length<=100&&long.endsWith(' #Shorts'));
});
test('Short description links the full video and keeps every source URL',()=>{
 const d=shortDescription({description:'Intro\n\nSources:\nhttps://en.wikipedia.org/wiki/Siloam_tunnel\nhttps://en.wikipedia.org/wiki/Siloam_inscription\n\nNarration is synthesized.'},'Two teams dug blind.','https://youtu.be/abc');
 assert.match(d,/▶ Full story: https:\/\/youtu\.be\/abc/);assert.match(d,/Siloam_tunnel/);assert.match(d,/Siloam_inscription/);
 const l=shortLocalizations({defaultLanguage:'en',items:{es:{title:'Cavando a ciegas',description:'x'.repeat(20)}}},'https://youtu.be/abc');
 assert.equal(l.items.es.title,'Cavando a ciegas #Shorts');assert.match(l.items.es.description,/youtu\.be\/abc/);
});
test('Short releases after the full video and never inside the processing lead time',()=>{
 const now=new Date('2026-10-11T10:00:00Z');
 assert.equal(shortPublishAt('2026-10-11T17:00:00.000Z',{shortsOffsetHours:3,minLeadHours:3},now),'2026-10-11T20:00:00.000Z');
 assert.equal(shortPublishAt('2026-10-01T17:00:00.000Z',{shortsOffsetHours:3,minLeadHours:3},now),'2026-10-11T13:00:00.000Z');
});
test('TikTok chunk plan and caption follow the Content Posting API rules',()=>{
 assert.deepEqual(chunkPlan(30*1024*1024),{chunkSize:30*1024*1024,count:1});
 assert.deepEqual(chunkPlan(105*1024*1024),{chunkSize:10*1024*1024,count:10});
 assert.equal(tiktokCaption('Tunneling in Darkness #Shorts',['#bible','#history']),'Tunneling in Darkness #bible #history');
});
test('TikTok inbox upload records the publish ID before sending bytes and never posts publicly',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiktok-'));try{const path=join(dir,'short.mp4');await writeFile(path,Buffer.alloc(1000,1));
  const calls:{url:string;init?:RequestInit}[]=[];let recorded='';
  const fake=(async(url:string,init?:RequestInit)=>{calls.push({url,init});const body=url.endsWith('/oauth/token/')?{access_token:'t',refresh_token:'r'}:url.includes('/inbox/video/init/')?{data:{publish_id:'p1',upload_url:'https://upload.example/u'},error:{code:'ok'}}:{};return new Response(JSON.stringify(body),{status:200});}) as typeof fetch;
  const config=tiktokConfig.parse({enabled:true,mode:'inbox',privacyLevel:'SELF_ONLY',isAigc:true,hashtags:['#bible']});
  const result=await sendToTikTok(path,'Title #Shorts',config,{key:'k',secret:'s',refresh:'r'},async id=>{recorded=id;assert.equal(calls.filter(c=>c.init?.method==='PUT').length,0,'record before upload');},fake);
  assert.equal(result.publishId,'p1');assert.equal(recorded,'p1');assert.equal(result.rotated,false);
  const put=calls.find(c=>c.init?.method==='PUT')!;assert.equal((put.init!.headers as Record<string,string>)['Content-Range'],'bytes 0-999/1000');
  assert.ok(!calls.some(c=>c.url.includes('/video/init/')&&!c.url.includes('/inbox/')),'inbox mode never calls direct post');
 }finally{await rm(dir,{recursive:true});}
});
test('TikTok direct mode refuses a privacy level the account does not offer',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tiktok-'));try{const path=join(dir,'short.mp4');await writeFile(path,Buffer.alloc(10,1));
  const fake=(async(url:string)=>new Response(JSON.stringify(url.endsWith('/oauth/token/')?{access_token:'t'}:{data:{privacy_level_options:['SELF_ONLY']},error:{code:'ok'}}),{status:200})) as typeof fetch;
  const config=tiktokConfig.parse({enabled:true,mode:'direct',privacyLevel:'PUBLIC_TO_EVERYONE',isAigc:true,hashtags:[]});
  await assert.rejects(sendToTikTok(path,'Title',config,{key:'k',secret:'s',refresh:'r'},async()=>{},fake),/does not allow privacy PUBLIC_TO_EVERYONE/);
 }finally{await rm(dir,{recursive:true});}
});
