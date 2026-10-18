import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {exec} from '../src/orchestration/io';

test('episode guard handles more than 1 MiB of GitHub history and retains its attempt cap',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'episode-history-'));
 try{
  const runs=Array.from({length:100},()=>({display_title:'production-bible-angels-001',conclusion:'failure',created_at:new Date().toISOString(),status:'completed',unusedPayload:'x'.repeat(20000)}));
  const fixture=JSON.stringify({workflow_runs:runs});assert.ok(Buffer.byteLength(fixture)>1024*1024);
  await writeFile(join(dir,'history.json'),fixture);
  const config=JSON.parse(await readFile('config/episode-delivery.json','utf8'));
  await mkdir(join(dir,'config'));
  await writeFile(join(dir,'config/episode-delivery.json'),JSON.stringify({...config,enabled:true,notBefore:new Date(Date.now()-86400000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}));
  // Execute the real jq projection, as gh does, before the CLI captures stdout.
  await writeFile(join(dir,'gh'),'#!/usr/bin/env node\n'+
   'const {readFileSync}=require("node:fs");const {execFileSync}=require("node:child_process");'+
   'const args=process.argv.slice(2);if(args[0]!=="api")process.exit(90);'+
   'const body=readFileSync(process.env.EPISODE_HISTORY_FIXTURE,"utf8");const i=args.indexOf("--jq");'+
   'process.stdout.write(i<0?body:execFileSync("jq",[args[i+1]],{input:body,maxBuffer:4*1024*1024}));\n',{mode:0o755});
  const cli=resolve('scripts/resume-approved-episode.ts');
  const {stdout}=await exec(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),cli],{cwd:dir,env:{...process.env,PATH:dir+':'+process.env.PATH,GITHUB_REPOSITORY:'gaboplayt24-art/youtube-autopilot',GITHUB_STEP_SUMMARY:'',DISPATCH_READY:'false',EPISODE_HISTORY_FIXTURE:join(dir,'history.json')},timeout:30000});
  const report=JSON.parse(stdout.trim());assert.equal(report.decision,'attempt-cap-reached');assert.equal(report.dispatched,false);
  // A completed episode must stay disabled even if dispatch is requested; gh must never be invoked.
  await writeFile(join(dir,'config/episode-delivery.json'),JSON.stringify({...config,enabled:false}));
  await writeFile(join(dir,'gh'),'#!/bin/sh\nexit 90\n',{mode:0o755});
  const stopped=await exec(process.execPath,['--import',resolve('node_modules/tsx/dist/loader.mjs'),cli],{cwd:dir,env:{...process.env,PATH:dir+':'+process.env.PATH,GITHUB_REPOSITORY:'gaboplayt24-art/youtube-autopilot',GITHUB_STEP_SUMMARY:'',DISPATCH_READY:'true'},timeout:30000});
  assert.equal(JSON.parse(stopped.stdout.trim()).decision,'disabled');assert.equal(JSON.parse(stopped.stdout.trim()).dispatched,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
