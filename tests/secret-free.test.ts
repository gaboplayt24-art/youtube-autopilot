import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {exec} from '../src/orchestration/io';
import {freeProviderSmoke} from '../src/cost/smoke';
test('optional Pexels absence is skipped, and stock smoke contracts use mocked HTTP with no real secrets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'optional-stock-'));const previous=globalThis.fetch,oldKey=process.env.PEXELS_API_KEY;delete process.env.PEXELS_API_KEY;
 try{const fixture=join(dir,'fixture.png');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=1280x720','-frames:v','1',fixture]);const bytes=await readFile(fixture);let requests=0;
 globalThis.fetch=async(input)=>{requests++;const url=String(input);assert.ok(!url.includes('pexels'));if(url.includes('commons.wikimedia.org/w/api.php'))return Response.json({query:{pages:{1:{imageinfo:[{url:'https://upload.wikimedia.org/mock.png',width:1280,height:720,descriptionurl:'https://commons.wikimedia.org/wiki/File:Mock.png',extmetadata:{LicenseShortName:{value:'Public domain'}}}]}}}});assert.equal(url,'https://upload.wikimedia.org/mock.png');return new Response(bytes,{headers:{'content-type':'image/png'}});};
 await freeProviderSmoke(dir);const report=JSON.parse(await readFile(join(dir,'provider-smoke.json'),'utf8'));assert.equal(report.checks.find((c:any)=>c.provider==='pexels').status,'skipped_optional');assert.equal(report.checks.find((c:any)=>c.provider==='wikimedia').status,'passed');assert.equal(requests,2);
 }finally{globalThis.fetch=previous;if(oldKey!==undefined)process.env.PEXELS_API_KEY=oldKey;await rm(dir,{recursive:true});}
});
