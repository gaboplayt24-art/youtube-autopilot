import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {z} from 'zod';
import {exec} from '../src/orchestration/io';
import {reviewShotContent,type SourceFrame} from '../src/visuals/illustrated';
test('shot QA rejects generic portrait instead of narrated coin counting and permits supporting male workers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'shot-content-'));try{
  const sheet=join(dir,'canonical.jpg');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=orange:s=64x64','-frames:v','1',sheet]);
  const frames=[{id:'merchant',path:join(dir,'merchant'),concept:'Close-up hands counting silver coins',character:true},{id:'workers',path:join(dir,'workers'),concept:'Male porters carrying a crate',character:false}] as SourceFrame[];
  for(const frame of frames)await exec('ffmpeg',['-y','-v','error','-i',sheet,'-frames:v','1',frame.path+'.review.jpg']);
  let calls=0;const outliers=await reviewShotContent(frames,sheet,dir,{images:async<T>(instruction:string,images:unknown[],schema:z.ZodType<T>)=>{calls++;assert.match(instruction,/Supporting male workers/);assert.equal(images.length,3);return schema.parse({reviews:[{sourceImageId:'merchant',subjectMatches:true,actionMatches:false,framingMatches:false,identityMatches:true,reason:'Standing portrait has no coin counting',repairDirection:'Hands and silver coins close-up, actually counting'},{sourceImageId:'workers',subjectMatches:true,actionMatches:true,framingMatches:true,identityMatches:null,reason:'Correct supporting role',repairDirection:''}]});}});
  assert.equal(calls,1);assert.deepEqual(outliers.map(o=>o.sourceImageId),['merchant']);assert.equal(JSON.parse(await readFile(join(dir,'shot-content-QA.json'),'utf8')).passed,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
